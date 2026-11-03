
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return reply({ error: "Method not allowed" }, 405);
  }

  try {
    const { username, password } = await req.json();

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !/^[a-zA-Z0-9_]{3,24}$/.test(username) ||
      password.length < 8 ||
      password.length > 128
    ) {
      return reply({ error: "Invalid username or password." }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !key) {
      return reply({ error: "Server configuration missing." }, 500);
    }

    const admin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const clean = username.trim().toLowerCase();

    let email: string | null = null;

    for (let page = 1; page <= 20; page++) {
      const { data, error } =
        await admin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });

      if (error) throw error;

      const user = data.users.find((u) => {
        const saved = String(
          u.user_metadata?.username || ""
        ).toLowerCase();

        return saved === clean;
      });

      if (user?.email) {
        email = user.email;
        break;
      }

      if (data.users.length < 1000) break;
    }

    if (!email) {
      return reply({
        error: "Invalid username or password.",
      }, 401);
    }

    const { data, error } =
      await admin.auth.signInWithPassword({
        email,
        password,
      });

    if (error || !data.session) {
      return reply({
        error: "Invalid username or password.",
      }, 401);
    }

    return reply({
      session: data.session,
    });

  } catch (error) {
    console.error("Username login error:", error);
    return reply({
      error: "Login service temporarily unavailable.",
    }, 500);
  }
});
