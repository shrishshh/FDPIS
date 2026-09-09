/**
 * The only data boundary in the application.
 *
 * Components import from here (or from the modules below) and never from
 * /lib/mock. Replacing the bodies of these functions with fetch() calls is the
 * entire backend integration.
 */
export * from "@/lib/api/config";
export * from "@/lib/api/flights";
export * from "@/lib/api/rotations";
export * from "@/lib/api/cascade";
export * from "@/lib/api/performance";
