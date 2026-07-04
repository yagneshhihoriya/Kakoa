/**
 * POST /api/auth/otp/verify — public · Class C attempt-limited (auth-otp.md §5.2).
 *
 * validate (400) → verifyCode (401 OTP_INCORRECT w/ attemptsLeft | 410
 * OTP_EXPIRED for every other cause) → on success ONE transaction:
 *   1. atomic consume the challenge (rolls back with the tx on later failure);
 *   2. upsert `customers` by phone (create ⇒ phone_verified_at=now(),
 *      isNewCustomer);
 *   3. create a fresh session (rotation — never reuse a pre-auth id);
 *   4. merge the guest cart via `mergeCartLines` (guest cart → status='merged',
 *      cart cookie rotated to the customer's active cart);
 *   5. attach guest orders WHERE contact_phone = phone AND customer_id IS NULL.
 * Then Set-Cookie session; 200 AuthVerifyResult. Tx failure ⇒ 500.
 *
 * NEVER logs the raw code/token/phone — only `sha256(destination)` (§6).
 */
import {
  mergeCartLines,
  otpVerifyInputSchema,
  type AuthVerifyResult,
  type MergeCartLine,
} from '@kakoa/core';
import {
  carts,
  cartItems,
  customers,
  db,
  orders,
  productVariants,
} from '@kakoa/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import { jsonErr, jsonOk, NO_STORE, toFieldErrors } from '@/lib/api/http';
import { readCartToken, rotateCartCookie } from '@/lib/cart/cookies';
import { consumeChallenge, hashDestination, verifyCode } from '@/lib/auth/otp';
import { clientIp, userAgent } from '@/lib/auth/request-context';
import { createSession, hashToken, setSessionCookie } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const INVALID_CODE_MESSAGE = 'Enter the 6-digit code we sent you.';
const EXPIRED_MESSAGE = 'This code has expired — request a new one.';
const INTERNAL_MESSAGE = 'Something went wrong — request a new code.';

interface TxResult {
  customer: AuthVerifyResult['customer'];
  cartMerged: boolean;
  isNewCustomer: boolean;
  sessionToken: string;
  survivingCartToken: string | null;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('VALIDATION_ERROR', INVALID_CODE_MESSAGE);
  }

  const parsed = otpVerifyInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('VALIDATION_ERROR', INVALID_CODE_MESSAGE, {
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
    });
  }
  const { challengeId, code } = parsed.data;

  // Hash compare + attempts increment happen here (not consumed yet).
  const outcome = await verifyCode({ challengeId, code });
  if (outcome.status === 'incorrect') {
    return jsonErr(
      'OTP_INCORRECT',
      `Incorrect code — ${String(outcome.attemptsLeft)} attempts left.`,
      { details: { attemptsLeft: outcome.attemptsLeft } },
    );
  }
  if (outcome.status === 'expired') {
    return jsonErr('OTP_EXPIRED', EXPIRED_MESSAGE);
  }

  const { destination, purpose } = outcome.challenge;
  const destinationHash = hashDestination(destination);
  const ip = clientIp(req);
  const ua = userAgent(req);

  // Guest cart token read OUTSIDE the tx (cookie read); the merge itself is
  // inside the tx. `customer_login` uses the phone (sms) channel — destination
  // is the E.164 phone.
  const guestToken = await readCartToken();

  try {
    const result = await db.transaction(async (tx): Promise<TxResult> => {
      // 1. Atomic consume — inside the tx so any later failure un-consumes it
      //    on rollback (§7 edge case 8). Zero rows ⇒ a race won or clock ran
      //    out ⇒ abort into the 410 path.
      const consumed = await consumeChallenge(challengeId, tx);
      if (!consumed) throw new ConsumeLost();

      // 2. Upsert customer by phone. Create ⇒ phone_verified_at=now(),
      //    isNewCustomer. Existing ⇒ stamp phone_verified_at if not already.
      const inserted = await tx
        .insert(customers)
        .values({
          phone: destination,
          phoneVerifiedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: customers.phone,
          set: {
            phoneVerifiedAt: sql`COALESCE(${customers.phoneVerifiedAt}, now())`,
            updatedAt: sql`now()`,
          },
        })
        .returning({
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          email: customers.email,
          // xmax = 0 for a freshly INSERTed row; non-zero when the ON CONFLICT
          // UPDATE path ran — reliable insert-vs-update discriminator.
          inserted: sql<boolean>`(xmax = 0)`,
        });

      const customer = inserted[0];
      if (!customer || customer.phone === null) {
        throw new Error('customer upsert returned no row');
      }
      const isNewCustomer = customer.inserted;

      // 3. Rotate session — always a fresh row (fixation defense, §6).
      const { token: sessionToken } = await createSession(
        customer.id,
        ip,
        ua,
        tx,
      );

      // 4. Merge the guest cart into the customer's active cart.
      const { cartMerged, survivingCartToken } = await mergeGuestCartIntoCustomer(
        tx,
        customer.id,
        guestToken,
      );

      // 5. Attach guest orders on the now-verified phone (verified-identifier
      //    only, §7 edge case 7). Email-matched orders are NOT attached here.
      await tx
        .update(orders)
        .set({ customerId: customer.id, updatedAt: sql`now()` })
        .where(
          and(eq(orders.contactPhone, destination), isNull(orders.customerId)),
        );

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        },
        cartMerged,
        isNewCustomer,
        sessionToken,
        survivingCartToken,
      };
    });

    // Cookie writes happen AFTER the tx commits (Route Handler scope).
    await setSessionCookie(result.sessionToken);
    if (result.survivingCartToken !== null) {
      await rotateCartCookie(result.survivingCartToken);
    }

    console.info('auth.otp_verified', {
      destination_hash: destinationHash,
      purpose,
      is_new_customer: result.isNewCustomer,
      cart_merged: result.cartMerged,
      session_token_hash: hashToken(result.sessionToken).slice(0, 16),
    });

    const payload: AuthVerifyResult = {
      customer: result.customer,
      cartMerged: result.cartMerged,
      isNewCustomer: result.isNewCustomer,
    };
    return jsonOk(payload, { cacheControl: NO_STORE });
  } catch (cause) {
    if (cause instanceof ConsumeLost) {
      // The consume rolled back; the code was never spent from the client's
      // perspective. Same 410 message as every other expired cause (no oracle).
      return jsonErr('OTP_EXPIRED', EXPIRED_MESSAGE);
    }
    console.error('auth.otp_verify_internal', {
      destination_hash: destinationHash,
      cause: cause instanceof Error ? cause.message : 'unknown',
    });
    return jsonErr('INTERNAL', INTERNAL_MESSAGE);
  }
}

/** Sentinel: atomic consume lost the race (→ 410, tx already rolled back). */
class ConsumeLost extends Error {
  constructor() {
    super('otp consume race lost');
    this.name = 'ConsumeLost';
  }
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Merge the guest cart (identified by `guestToken`) into the customer's active
 * cart, all inside the caller's transaction (§2 step 8, cart.md §5 merge
 * contract). Pure line policy lives in `mergeCartLines`; this only does the DB
 * plumbing:
 *
 *  - resolve the guest's active cart (silently skip if none/terminal/expired);
 *  - resolve or lazily create the customer's active cart;
 *  - run `mergeCartLines` with live stock, rewrite the customer's lines;
 *  - guest coupon wins only when the customer cart has none (cart-level policy);
 *  - guest cart → status='merged', merged_into_cart_id set;
 *  - return the SURVIVING (customer) cart token for cookie rotation.
 *
 * When the guest already IS this customer (customer_id already set on the guest
 * cart) or there is no guest cart, nothing is merged and the surviving token is
 * the customer's active cart (or null if none exists).
 */
async function mergeGuestCartIntoCustomer(
  tx: DbTx,
  customerId: string,
  guestToken: string | null,
): Promise<{ cartMerged: boolean; survivingCartToken: string | null }> {
  // Resolve the guest cart from the token (active + unexpired only).
  const guestCart =
    guestToken === null
      ? null
      : (
          await tx
            .select({
              id: carts.id,
              token: carts.token,
              customerId: carts.customerId,
              couponId: carts.couponId,
            })
            .from(carts)
            .where(
              and(
                eq(carts.token, guestToken),
                eq(carts.status, 'active'),
                sql`${carts.expiresAt} > now()`,
              ),
            )
            .limit(1)
        )[0] ?? null;

  // Resolve the customer's existing active cart, if any.
  const ownedCart =
    (
      await tx
        .select({ id: carts.id, token: carts.token, couponId: carts.couponId })
        .from(carts)
        .where(
          and(
            eq(carts.customerId, customerId),
            eq(carts.status, 'active'),
            sql`${carts.expiresAt} > now()`,
          ),
        )
        .limit(1)
    )[0] ?? null;

  // No guest cart, or the guest cart is already owned by someone → nothing to
  // merge; surviving token is the customer's cart if present.
  if (guestCart === null || guestCart.customerId !== null) {
    return { cartMerged: false, survivingCartToken: ownedCart?.token ?? null };
  }

  const guestLines = await selectMergeLines(tx, guestCart.id);

  // Case A: customer has no active cart → adopt the guest cart directly by
  // re-parenting is FORBIDDEN (fixation, §6). Instead create a fresh owned cart
  // and copy the guest lines by value.
  const targetCart =
    ownedCart ??
    (
      await tx
        .insert(carts)
        .values({ customerId })
        .returning({ id: carts.id, token: carts.token, couponId: carts.couponId })
    )[0]!;

  const ownedLines =
    ownedCart === null ? [] : await selectMergeLines(tx, targetCart.id);

  // Live stock for every variant involved → clamp during merge.
  const variantIds = Array.from(
    new Set([...guestLines, ...ownedLines].map((l) => l.variantId)),
  );
  const stockByVariantId: Record<string, number> = {};
  if (variantIds.length > 0) {
    const stocks = await tx
      .select({
        id: productVariants.id,
        stock: productVariants.stockQuantity,
        active: productVariants.isActive,
      })
      .from(productVariants)
      .where(inArray(productVariants.id, variantIds));
    for (const s of stocks) {
      stockByVariantId[s.id] = s.active ? s.stock : 0;
    }
  }

  const merged = mergeCartLines(guestLines, ownedLines, stockByVariantId);

  // Rewrite the target cart's lines to the merged set (copy-by-value).
  await tx.delete(cartItems).where(eq(cartItems.cartId, targetCart.id));
  if (merged.length > 0) {
    await tx.insert(cartItems).values(
      merged.map((line) => ({
        cartId: targetCart.id,
        variantId: line.variantId,
        quantity: line.qty,
        giftWrap: line.giftWrap,
        giftMessage: line.giftMessage,
      })),
    );
  }

  // Cart-level coupon: guest coupon wins only when the customer cart has none.
  if (targetCart.couponId === null && guestCart.couponId !== null) {
    await tx
      .update(carts)
      .set({ couponId: guestCart.couponId, updatedAt: sql`now()` })
      .where(eq(carts.id, targetCart.id));
  } else {
    await tx
      .update(carts)
      .set({ updatedAt: sql`now()` })
      .where(eq(carts.id, targetCart.id));
  }

  // Retire the guest cart (status='merged'; old token replays to empty, §6).
  await tx
    .update(carts)
    .set({
      status: 'merged',
      mergedIntoCartId: targetCart.id,
      updatedAt: sql`now()`,
    })
    .where(eq(carts.id, guestCart.id));

  // `cartMerged` = the guest actually contributed lines to fold in (§5.2 UI
  // toast "Your cart items were saved"). An empty guest cart is retired but is
  // not a "merge" from the customer's perspective.
  return {
    cartMerged: guestLines.length > 0,
    survivingCartToken: targetCart.token,
  };
}

/** Load a cart's lines in the merge-policy shape. */
async function selectMergeLines(
  tx: DbTx,
  cartId: string,
): Promise<MergeCartLine[]> {
  const rows = await tx
    .select({
      variantId: cartItems.variantId,
      qty: cartItems.quantity,
      giftWrap: cartItems.giftWrap,
      giftMessage: cartItems.giftMessage,
    })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return rows.map((r) => ({
    variantId: r.variantId,
    qty: r.qty,
    giftWrap: r.giftWrap,
    giftMessage: r.giftMessage,
  }));
}
