import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, password, nombre } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user
    const { data: userData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre: nombre || "Admin" },
      });

    if (createError) {
      // If user already exists, find them
      if (createError.message.includes("already been registered")) {
        const { data: { users }, error: listErr } =
          await supabaseAdmin.auth.admin.listUsers();
        if (listErr) throw listErr;
        const existingUser = users.find((u: any) => u.email === email);
        if (!existingUser) throw new Error("User not found after creation attempt");

        // Assign admin role
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: existingUser.id, role: "admin" },
            { onConflict: "user_id,role" }
          );
        if (roleErr) throw roleErr;

        return new Response(
          JSON.stringify({ message: "Admin role assigned to existing user", user_id: existingUser.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw createError;
    }

    // Assign admin role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userData.user.id, role: "admin" });
    if (roleErr) throw roleErr;

    return new Response(
      JSON.stringify({ message: "Admin user created", user_id: userData.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
