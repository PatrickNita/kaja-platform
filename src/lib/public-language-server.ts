import "server-only";
import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, publicLanguage } from "./public-language";
export async function readPublicLanguage() { return publicLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value); }
