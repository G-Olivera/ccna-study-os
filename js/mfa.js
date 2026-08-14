// mfa.js
// Autenticação de dois fatores usando TOTP (código de 6 dígitos gerado por um
// app autenticador — Google Authenticator, Authy, etc). Escolhido em vez de
// SMS porque TOTP não tem custo nenhum (SMS via Firebase cobra por mensagem).

import {
  multiFactor,
  TotpMultiFactorGenerator,
  getMultiFactorResolver,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

/** Quantos fatores de segundo passo o usuário já tem cadastrados. */
export function listarFatoresMFA(user) {
  return multiFactor(user).enrolledFactors;
}

/**
 * Passo 1 do cadastro: gera a chave secreta TOTP. Mostre `secretKey` pro
 * usuário digitar manualmente no app autenticador (funciona em todos eles,
 * não depende de conseguir escanear QR code).
 */
export async function iniciarCadastroMFA(user) {
  const session = await multiFactor(user).getSession();
  const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
  return {
    totpSecret,
    secretKey: totpSecret.secretKey,
    uriOtpauth: totpSecret.generateQrCodeUrl(user.email || "usuário", "CCNA Study OS"),
  };
}

/** Passo 2: confirma o cadastro com o código de 6 dígitos gerado pelo app. */
export async function confirmarCadastroMFA(user, totpSecret, codigo) {
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, codigo);
  await multiFactor(user).enroll(assertion, "App autenticador");
}

export async function removerFatorMFA(user, fatorUid) {
  await multiFactor(user).unenroll(fatorUid);
}

/** Chame isso quando o login der erro auth/multi-factor-auth-required. */
export function getResolverMFA(error) {
  return getMultiFactorResolver(auth, error);
}

/** Completa o login depois que o usuário digita o código do segundo fator. */
export async function confirmarLoginMFA(resolver, codigo) {
  const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) || resolver.hints[0];
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, codigo);
  return await resolver.resolveSignIn(assertion);
}
