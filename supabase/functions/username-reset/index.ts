
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") {
      return reply({ error: "Method not allowed." }, 405);
    }

    const { username } = await req.json();

    if (!username || typeof username !== "string") {
      return reply({ error: "Username is required." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey);

    let email: string | null = null;

    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) throw error;

      const user = data.users.find(
        (u) =>
          String(u.user_metadata?.username || "").toLowerCase() ===
          username.trim().toLowerCase()
      );

      if (user) {
        email = user.email || null;
        break;
      }

      if (data.users.length < 1000) break;
    }

    if (!email) {
      return reply({ error: "Username not found." }, 404);
    }

    const { error } = await admin.auth.resetPasswordForEmail(email);

    if (error) throw error;

    return reply({
      message: "Password reset email sent successfully.",
    });
  } catch (error) {
    console.error("Username reset error:", error);
    return reply({ error: "Password reset service unavailable." }, 500);
  }
});
