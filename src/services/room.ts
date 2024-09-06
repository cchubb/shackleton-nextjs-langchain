import { supabaseClient } from "@/libs/supabaseClient";

export interface IRoom {
  id?: number | undefined;
  created_at?: Date | undefined;
}

// Fetch the list of chat rooms from the Supabase database.
export async function fetchRooms(): Promise<IRoom[]> {
  const { data, error } = await supabaseClient
    .from("rooms")
    .select()
    .order("created_at", { ascending: false })
    .returns<IRoom[]>();

  if (error) throw error;

  return data;
}

// Create a new chat room in the database.
export async function createRoom(): Promise<IRoom> {
  const { data, error } = await supabaseClient
    .from("rooms")
    .insert({})
    .select()
    .single<IRoom>();

  if (error) throw error;

  return data;
}
