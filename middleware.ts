import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Caminhos EXTERNOS das transportadoras
  const portalTransportadoraRoutes = [
    "/portal-transportadora",
    "/portal-transportadora/login"
  ];

  const isPortalTransportadora = portalTransportadoraRoutes.some((path) =>
    url.pathname.startsWith(path)
  );

  if (isPortalTransportadora) {
    // O portal externo NÃO exige autenticação do sistema interno
    return NextResponse.next();
  }

  // Todas as demais rotas continuam funcionando normalmente
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
