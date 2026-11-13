// Cloud Functions do projeto gvq-ordens-de-compra.
// lerMarcas: recebe fotos do gado e devolve as marcas a fogo desenhadas (functions/marcas.js).
// A chave da API da Anthropic fica no Secret Manager (ANTHROPIC_API_KEY), nunca no site.
// Só atende quem está logado no ambiente Ordens de Compra com cadastro ativo.
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { lerMarcas as ler, validarEntrada, ErroEntrada } from "./marcas.js";

initializeApp();
const CHAVE = defineSecret("ANTHROPIC_API_KEY");

export const lerMarcas = onRequest({
    region: "southamerica-east1",
    secrets: [CHAVE],
    cors: [/^https?:\/\/localhost(:\d+)?$/, "https://wiziackmatheeus-sys.github.io"],
    timeoutSeconds: 540,
    memory: "512MiB",
    maxInstances: 3,
}, async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ erro: "Use POST." });
    try {
        const token = (req.get("Authorization") || "").replace(/^Bearer /, "");
        const usuario = await getAuth().verifyIdToken(token).catch(() => null);
        if (!usuario?.email) return res.status(401).json({ erro: "Faça login novamente." });
        const cadastro = await getFirestore().doc(`usuarios/${usuario.email.split("@")[0]}`).get();
        if (!cadastro.exists || cadastro.data().ativo === false) return res.status(403).json({ erro: "Seu acesso está desativado." });

        res.json(await ler(validarEntrada(req.body), CHAVE.value()));
    } catch (error) {
        if (error instanceof ErroEntrada) return res.status(400).json({ erro: error.message });
        console.error(error);
        res.status(500).json({ erro: "Não foi possível ler as marcas agora. Tente de novo." });
    }
});
