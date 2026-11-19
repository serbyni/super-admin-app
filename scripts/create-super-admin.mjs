// Creates (or promotes) a Serbi super admin. Nothing is hard-coded: values come from the
// environment or are typed in when the script runs.
//
//   SUPABASE_SECRET_KEY=sb_secret_... npm run admin:create
//   (optional) ADMIN_EMAIL=you@serbi.me ADMIN_PASSWORD='...' npm run admin:create
//
// Needs NEXT_PUBLIC_SUPABASE_URL (from .env.local) and SUPABASE_SECRET_KEY (Supabase →
// Project Settings → API Keys → secret key). Never commit the secret key or put it in Vercel's
// public variables.
import { createInterface } from "node:readline/promises";
import { stdin, stdout, env, exit } from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.");
  exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const email = (env.ADMIN_EMAIL ?? (await rl.question("Admin email: "))).trim().toLowerCase();
const password =
  env.ADMIN_PASSWORD ?? (await rl.question("Admin password (min 10, upper, digit, symbol): "));
rl.close();

const strong =
  password.length >= 10 &&
  /[A-Z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9]/.test(password);
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Invalid email.");
  exit(1);
}
if (!strong) {
  console.error(
    "Password too weak: use 10+ characters with an upper-case letter, a digit and a symbol.",
  );
  exit(1);
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Serbi Admin" },
});
if (createError) {
  if (createError.code !== "email_exists") {
    console.error("Could not create user:", createError.message);
    exit(1);
  }
  // Existing user: find it and promote (password is NOT changed).
  for (let page = 1; !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("Could not list users:", error.message);
      exit(1);
    }
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 1000) break;
  }
  if (!userId) {
    console.error("User exists but could not be found.");
    exit(1);
  }
  console.log("User already exists — promoting without changing the password.");
} else {
  userId = created.user.id;
  console.log("User created.");
}

const { error: grantError } = await admin.rpc("grant_platform_admin", { p_user_id: userId });
if (grantError) {
  console.error("Could not grant super admin:", grantError.message);
  exit(1);
}
console.log(`✓ ${email} is a Serbi super admin. Sign in at /login → /admin.`);
