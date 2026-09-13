/**
 * The only data boundary in the application.
 *
 * Every function here calls the FastAPI backend. Components import from this
 * module and never construct a URL of their own.
 */
export * from "@/lib/api/client";
export * from "@/lib/api/config";
export * from "@/lib/api/reference";
export * from "@/lib/api/flights";
export * from "@/lib/api/rotations";
export * from "@/lib/api/cascade";
export * from "@/lib/api/performance";
