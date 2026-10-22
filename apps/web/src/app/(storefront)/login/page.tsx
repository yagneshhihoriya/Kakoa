import { redirect } from "next/navigation";

/**
 * `/login` has no page of its own — sign-in is the `LoginSheet` modal, opened
 * from the header. This route exists only so the path stays reachable (old
 * links, typed URLs, the pre-auth-module placeholder it replaced): it bounces
 * to the home page with `?login=1`, the deep-link AuthProvider already honours
 * to open the sheet and strip the param. Temporary (307), not permanent — a
 * real login page may land here later.
 */
export default function LoginPage(): never {
  redirect("/?login=1");
}
