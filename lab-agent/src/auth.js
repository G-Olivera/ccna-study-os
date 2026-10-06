// auth.js — valida o ID token do Firebase Auth (o mesmo login + MFA do app).
// Não precisa de service account: a assinatura é conferida com as chaves
// públicas do Google, e o "aud"/"iss" amarram o token ao projeto ccna-study-os.

import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config.js";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export async function verificarToken(token) {
  if (!token || typeof token !== "string") throw new ErroAuth("Token ausente.");
  let payload;
  try {
    ({ payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${config.firebaseProjectId}`,
      audience: config.firebaseProjectId,
      algorithms: ["RS256"],
    }));
  } catch {
    throw new ErroAuth("Token inválido ou expirado.");
  }
  if (!config.uidsPermitidos.includes(payload.sub)) throw new ErroAuth("Usuário não autorizado neste agente.", 403);
  if (config.exigirMfa && !payload.firebase?.sign_in_second_factor) {
    throw new ErroAuth("Login sem MFA. Entre de novo com o código do autenticador.", 403);
  }
  return { uid: payload.sub, email: payload.email };
}

export class ErroAuth extends Error {
  constructor(msg, status = 401) {
    super(msg);
    this.status = status;
  }
}

export function middlewareAuth(req, res, next) {
  const [tipo, token] = (req.headers.authorization || "").split(" ");
  verificarToken(tipo === "Bearer" ? token : null)
    .then((usuario) => {
      req.usuario = usuario;
      next();
    })
    .catch((e) => res.status(e.status || 401).json({ erro: e.message }));
}
