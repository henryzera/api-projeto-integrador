import { describe, expect, it } from 'vitest';

import { calculateCompatibilityScore } from '../src/utils/contratacaoCompatibility';

describe('calculateCompatibilityScore', () => {
  it('returns neutral 50 when no CNAE is provided', () => {
    const contratacao = {
      objetoCompra: 'Desenvolvimento de sistema web e suporte tecnico'
    };

    expect(calculateCompatibilityScore(contratacao)).toBe(50);
  });

  it('returns neutral 50 when the CNAE prefix is not mapped', () => {
    const contratacao = {
      objetoCompra: 'Desenvolvimento de sistema web'
    };

    // 99 nao esta no mapa de prefixos.
    expect(calculateCompatibilityScore(contratacao, '9999999')).toBe(50);
  });

  it('returns the floor (35) when CNAE is known but no keyword matches', () => {
    const contratacao = {
      objetoCompra: 'Aquisicao de cimento e areia'
    };

    // 6201 (TI) conhecido, mas o objeto nao tem termos de TI.
    expect(calculateCompatibilityScore(contratacao, '6201500')).toBe(35);
  });

  it('boosts the score when keywords match (accent/case insensitive)', () => {
    const contratacao = {
      objetoCompra: 'Contratação de empresa para DESENVOLVIMENTO e manutenção de SOFTWARE e suporte de sistema'
    };

    const score = calculateCompatibilityScore(contratacao, '6201500');

    // 35 + min(matches * 13, 65). Varios termos batem -> score alto.
    expect(score).toBeGreaterThanOrEqual(74);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('caps the score at 100', () => {
    const contratacao = {
      objetoCompra:
        'software sistema tecnologia informatica desenvolvimento suporte aplicativo programacao'
    };

    expect(calculateCompatibilityScore(contratacao, '6201500')).toBe(100);
  });

  it('matches construction CNAE keywords', () => {
    const contratacao = {
      objetoCompra: 'Reforma e construcao de edificacao predial com obra civil'
    };

    expect(calculateCompatibilityScore(contratacao, '4120400')).toBeGreaterThan(50);
  });

  it('keeps the score within the 0-100 range', () => {
    const contratacao = { objetoCompra: '' };
    const score = calculateCompatibilityScore(contratacao, '5611201');

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
