import { randomBytes } from 'node:crypto';
import type { Id } from '../dominio/tipos';

export type GeradorDeId = () => Id;
export type Relogio = () => Date;

/** 24 caracteres hexadecimais: formato compatível com ObjectId do MongoDB. */
export const gerarIdHexadecimal: GeradorDeId = () => randomBytes(12).toString('hex');

export const relogioDoSistema: Relogio = () => new Date();
