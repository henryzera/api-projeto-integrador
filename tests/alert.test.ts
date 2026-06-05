import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';

import {
  buildCompatibleNoticeAlertRecords,
  buildProposalAlertRecords,
  buildRelevanceFilter,
  parseDate
} from '../src/services/alert.service';

const userId = new ObjectId();
const cnaeTI = '6201500';
const now = new Date('2026-06-05T00:00:00Z');

describe('buildProposalAlertRecords', () => {
  it('generates an alert for a compatible contratacao within the deadline window', () => {
    const contratacoes = [
      {
        _id: 'c1',
        objetoCompra: 'Desenvolvimento de software e suporte de sistema',
        dataEncerramentoProposta: '2026-06-07T10:00:00'
      }
    ];

    const alerts = buildProposalAlertRecords(contratacoes, userId, cnaeTI, now);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].relatedType).toBe('contratacao');
    expect(alerts[0].sourceKey).toBe('proposal:c1');
  });

  it('skips contratacoes below the compatibility threshold', () => {
    const contratacoes = [
      {
        _id: 'c2',
        objetoCompra: 'Aquisicao de cimento e areia para obra',
        dataEncerramentoProposta: '2026-06-07T10:00:00'
      }
    ];

    // CNAE de TI vs objeto de construcao -> score 35 (< 50) -> sem alerta.
    expect(buildProposalAlertRecords(contratacoes, userId, cnaeTI, now)).toHaveLength(0);
  });

  it('skips contratacoes with an expired or far deadline', () => {
    const contratacoes = [
      {
        _id: 'expired',
        objetoCompra: 'Desenvolvimento de software',
        dataEncerramentoProposta: '2026-05-01T10:00:00'
      },
      {
        _id: 'far',
        objetoCompra: 'Desenvolvimento de software',
        dataEncerramentoProposta: '2026-12-01T10:00:00'
      }
    ];

    expect(buildProposalAlertRecords(contratacoes, userId, cnaeTI, now)).toHaveLength(0);
  });

  it('is idempotent through a stable sourceKey', () => {
    const contratacao = {
      _id: 'c3',
      objetoCompra: 'Sistema e software',
      dataEncerramentoProposta: '2026-06-06T10:00:00'
    };

    const first = buildProposalAlertRecords([contratacao], userId, cnaeTI, now);
    const second = buildProposalAlertRecords([contratacao], userId, cnaeTI, now);

    expect(first[0].sourceKey).toBe(second[0].sourceKey);
  });
});

describe('buildCompatibleNoticeAlertRecords', () => {
  it('generates notices only for highly compatible contratacoes', () => {
    const contratacoes = [
      { _id: 'hit', objetoCompra: 'Software sistema tecnologia desenvolvimento suporte' },
      { _id: 'miss', objetoCompra: 'Servico de limpeza e jardinagem' }
    ];

    const alerts = buildCompatibleNoticeAlertRecords(contratacoes, userId, cnaeTI, now);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].relatedId).toBe('hit');
    expect(alerts[0].sourceKey).toBe('compatible:hit');
  });

  it('caps the number of notices at 10', () => {
    const contratacoes = Array.from({ length: 20 }, (_unused, index) => ({
      _id: `n${index}`,
      objetoCompra: 'Software sistema tecnologia desenvolvimento suporte aplicativo'
    }));

    expect(buildCompatibleNoticeAlertRecords(contratacoes, userId, cnaeTI, now)).toHaveLength(10);
  });
});

describe('buildRelevanceFilter', () => {
  it('returns an empty filter when no UF is given', () => {
    expect(buildRelevanceFilter()).toEqual({});
  });

  it('builds a case-insensitive UF filter', () => {
    const filter = buildRelevanceFilter('pe') as { $or: Array<Record<string, RegExp>> };

    expect(filter.$or).toHaveLength(2);
    expect('PE').toMatch(filter.$or[0]['unidadeOrgao.ufSigla']);
    expect('pe').toMatch(filter.$or[1].uf);
  });
});

describe('parseDate (UTC explicit)', () => {
  it('interprets a TZ-less datetime as UTC', () => {
    const date = parseDate('2026-06-12T10:00:00');

    expect(date?.toISOString()).toBe('2026-06-12T10:00:00.000Z');
  });

  it('respects an explicit timezone offset', () => {
    const date = parseDate('2026-06-12T10:00:00-03:00');

    expect(date?.toISOString()).toBe('2026-06-12T13:00:00.000Z');
  });

  it('returns null for invalid input', () => {
    expect(parseDate('not-a-date')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});
