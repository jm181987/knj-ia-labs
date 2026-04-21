import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("SUPABASE_DB_URL no configurado");
    const sql = postgres(dbUrl, { prepare: false });

    await sql`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text`;

    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public'
      AS $function$
      begin
        insert into public.profiles (id, email, display_name, whatsapp)
        values (
          new.id,
          new.email,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
          nullif(new.raw_user_meta_data->>'whatsapp', '')
        );
        insert into public.user_roles (user_id, role) values (new.id, 'user');
        return new;
      end;
      $function$;
    `);

    await sql.end();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});