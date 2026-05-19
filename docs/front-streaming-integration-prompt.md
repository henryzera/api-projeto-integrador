# Prompt Para Agente Do Front: Integracao Do Streaming PNCP

Voce e o agente responsavel pelo front mobile do Projeto Integrador.

## Contexto

O backend REST da API foi ajustado para aceitar dois formatos de contratacao:

1. Formato completo/aninhado vindo do ETL original:

```json
{
  "unidadeOrgao": {
    "municipioNome": "Recife",
    "ufSigla": "PE",
    "codigoIbge": "2611606"
  }
}
```

2. Formato achatado vindo do novo ETL de streaming:

```json
{
  "uf": "pe",
  "municipioNome": "Recife",
  "codigoIbge": "2611606"
}
```

A API REST agora devolve fallbacks normalizados em `/contratacoes`, incluindo:

- `uf`
- `municipioNome`
- `codigoIbge`
- `unidadeOrgao.ufSigla`
- `unidadeOrgao.municipioNome`
- `unidadeOrgao.codigoIbge`

O front deve continuar usando REST para historico e WebSocket apenas para eventos novos em tempo real.

## URLs

API REST de producao:

```txt
https://api-projeto-integrador-hcu8.onrender.com
```

Streaming WebSocket de producao:

```txt
wss://cesar-engenharia-de-dados.onrender.com/ws/notificacoes
```

## Contrato Do Evento WebSocket

O WebSocket envia JSON no seguinte formato:

```json
{
  "_id": "6638ef...",
  "numeroCompra": "999/2026",
  "anoCompra": 2026,
  "objetoCompra": "Aquisicao de 50 Monitores para a Prefeitura",
  "valorTotalEstimado": 45000.0,
  "dataAtualizacao": "2026-05-14T10:00:00",
  "uf": "pe",
  "municipioNome": "Recife",
  "codigoIbge": "2611606"
}
```

## Regras De Integracao

1. Ao abrir a tela de Editais ou Alertas, buscar historico com REST:

```http
GET /contratacoes?limit=12&skip=0&uf=PE&municipio=Recife&meOnly=true
Authorization: Bearer <token>
```

2. Manter uma conexao WebSocket aberta enquanto o usuario estiver logado.

3. Quando chegar um evento WebSocket:
   - fazer `JSON.parse(event.data)`;
   - normalizar `uf` para exibicao como `PE`;
   - inserir a nova licitacao no topo da lista local, sem duplicar `_id`;
   - exibir alerta visual/toast/modal simples;
   - opcionalmente criar uma notificacao local via `expo-notifications`.

4. O WebSocket nao guarda historico. Se o app fechar, o front deve buscar o historico novamente pela API REST ao abrir.

5. Se a conexao cair, tentar reconectar automaticamente com intervalo de 5s ou backoff progressivo.

6. Ao fazer logout, fechar a conexao WebSocket e limpar estado local.

## Hook Sugerido

Criar um hook como:

```ts
import { useEffect, useRef, useState } from 'react';

const WS_URL = 'wss://cesar-engenharia-de-dados.onrender.com/ws/notificacoes';

export type StreamingLicitacao = {
  _id: string;
  numeroCompra: string | null;
  anoCompra: number | null;
  objetoCompra: string | null;
  valorTotalEstimado: number | null;
  dataAtualizacao: string | null;
  uf: string | null;
  municipioNome: string | null;
  codigoIbge: string | null;
};

export function useLicitacoesStreaming(enabled: boolean) {
  const [novaLicitacao, setNovaLicitacao] = useState<StreamingLicitacao | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let shouldReconnect = true;

    const connect = () => {
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as StreamingLicitacao;
          setNovaLicitacao({
            ...parsed,
            uf: parsed.uf ? parsed.uf.toUpperCase() : null
          });
        } catch (error) {
          console.error('[WebSocket] Erro ao parsear licitacao:', error);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);

        if (shouldReconnect) {
          reconnectTimeout.current = setTimeout(connect, 5000);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      shouldReconnect = false;

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }

      socketRef.current?.close();
    };
  }, [enabled]);

  return {
    isConnected,
    novaLicitacao
  };
}
```

## Integracao Na Tela De Editais

Na tela de editais:

1. Carregar lista inicial via REST.
2. Usar `useLicitacoesStreaming(Boolean(token))`.
3. Quando `novaLicitacao` mudar:
   - converter para o mesmo shape usado nos cards;
   - colocar no topo da lista;
   - evitar duplicidade por `_id`;
   - mostrar feedback visual.

Exemplo de merge:

```ts
setContratacoes((current) => {
  if (current.some((item) => item._id === novaLicitacao._id)) {
    return current;
  }

  return [novaLicitacao, ...current];
});
```

## Integracao Na Tela De Alertas

Na tela de alertas:

1. Continuar buscando historico em `GET /alerts`.
2. Usar o WebSocket para criar alerta local imediato do tipo "Nova oportunidade MEI/EPP".
3. O alerta local pode apontar para o detalhe de contratacao usando `_id`.
4. Ao reabrir o app, confiar no REST para reconstruir historico.

## Observacoes

- Nao substituir REST por WebSocket.
- Nao manter historico apenas em memoria do WebSocket.
- Fechar WebSocket no logout.
- Tratar reconexao, pois conexoes moveis podem cair.
- Para notificacao em background real, usar `expo-notifications`; WebSocket nativo nao permanece ativo com o app encerrado.
