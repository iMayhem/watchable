// Passthrough — SEO injection disabled to avoid Workers invocations on detail routes.
export async function onRequest(context: { next: () => Response | Promise<Response> }) {
    return context.next();
}