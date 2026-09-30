import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveSite } from "./adapter.mjs";
import { handleAegis } from "./handler.mjs";

Deno.serve(serveSite(handleAegis, {
  createClient,
  env: (name: string) => Deno.env.get(name),
}));
