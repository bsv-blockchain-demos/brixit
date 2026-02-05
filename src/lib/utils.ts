import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind class merging utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSupabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL2 || import.meta.env.VITE_SUPABASE_URL;
}

// this is apparently necessary to use as a bearer token and safe to expose for use as the "app key" and only allows access to public data
export function getPublishableKey(): string {
  return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
}