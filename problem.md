# Desafio Técnico — Fullstack

Você pode escolher entre Node.js e PHP Laravel para o backend.
Você precisa utilizar Next.js na implementação do frontend.

## Sistema de Monitoramento da Aliança Rebelde

Antes de tudo: obrigado por topar esse desafio.

Este desafio faz parte do nosso processo para a vaga de Engenheiro(a) de Software Pleno — Fullstack.

O objetivo aqui não é avaliar velocidade ou perfeição, mas sim:

- como você estrutura soluções;
- como toma decisões técnicas;
- como lida com concorrência e consistência;
- como conecta backend e frontend de forma coerente.

No segundo momento do processo, vamos conversar sobre sua solução e pedir algumas evoluções ao vivo.

---

## O contexto

Em um universo distante, a Aliança Rebelde mantém um sistema chamado **Holocron Sentinel**, responsável por monitorar entidades estratégicas ao longo da galáxia.

Essas entidades podem ser:

- planetas;
- bases rebeldes;
- naves importantes;
- ou qualquer outro ponto sensível.

O sistema registra eventos associados a essas entidades, que podem indicar desde atividades rotineiras até ameaças críticas do Império.

O sistema precisa operar com:

- alto volume de dados;
- múltiplas requisições simultâneas;
- consistência mesmo sob concorrência;
- atualização em tempo real.

---

## Conceitos principais

### Entidade monitorada

Representa algo que precisa ser acompanhado continuamente.

Campos:

- `id`
- `name`
- `status` (`active` ou `suspended`)
- `critical_events_count`
- `created_at`
- `updated_at`

Regras:

- Toda entidade começa como `active`;
- Pode ser automaticamente suspensa ao atingir um limite de eventos críticos;
- Entidades suspensas não devem aceitar novos eventos.

---

### Evento

Representa uma ocorrência associada a uma entidade.

Campos:

- `id`
- `entity_id`
- `external_id`
- `type` (`info`, `warning` ou `critical`)
- `payload` (JSON livre)
- `created_at`

Regras:

- Eventos só podem ser registrados para entidades ativas;
- Eventos do tipo `critical` incrementam o contador da entidade;
- Um mesmo `external_id` não pode ser processado duas vezes, mesmo com múltiplas requisições simultâneas.

---

## O que você precisa implementar

## Backend

### 1) Criar entidade monitorada

Endpoint para criação de uma nova entidade monitorada.

---

### 2) Listar entidades monitoradas

A listagem deve retornar, para cada entidade:

- dados básicos da entidade;
- total de eventos associados;
- total de eventos críticos;
- data do último evento registrado.

Atenção à performance:

- considere que podem existir milhares de entidades e milhões de eventos;
- pense em agregações eficientes.

---

### 3) Registrar evento

Este é o coração do sistema e merece atenção especial.

Esse endpoint deve:

- ser idempotente;
- ser seguro sob concorrência;
- garantir consistência mesmo com múltiplas requisições simultâneas;
- suspender automaticamente a entidade quando o limite de eventos críticos for atingido.

Fique à vontade para usar quaisquer estratégias que julgar adequadas.

O mais importante é conseguir explicar suas escolhas.

---

### 4) Ranking de entidades críticas

Endpoint que deve:

- retornar as entidades com mais eventos críticos nos últimos 7 dias;
- ordenar do mais crítico para o menos crítico;
- ser pensado para grandes volumes de dados.

---

### 5) Streaming de eventos

Implemente um endpoint de streaming em tempo real.

Você pode usar:

- Server-Sent Events (SSE), recomendado;
- WebSocket;
- ou outra estratégia, desde que explique a escolha.

Exemplo:

`GET /events/stream`

Esse endpoint deve:

- enviar eventos conforme são registrados;
- permitir múltiplos clientes conectados;
- manter consistência básica dos dados enviados;
- lidar minimamente com desconexão de clientes.

---

## Frontend

Crie uma interface simples para operadores do sistema.

---

### 1) Dashboard de entidades

Tela com:

- lista de entidades monitoradas;
- status (`active` ou `suspended`);
- total de eventos;
- total de eventos críticos;
- data do último evento registrado;
- destaque visual para entidades suspensas ou próximas do limite crítico.

---

### 2) Registro manual de evento

Formulário para registrar um evento.

O formulário deve permitir:

- selecionar uma entidade;
- informar o `external_id`;
- escolher o tipo do evento;
- enviar um `payload` JSON.

A interface deve:

- mostrar sucesso;
- mostrar erro;
- evidenciar quando um evento duplicado foi ignorado por idempotência.

---

### 3) Feed de eventos em tempo real

Tela ou componente com:

- lista dos eventos recentes;
- atualização automática via streaming;
- recebimento de novos eventos sem recarregar a página.

O frontend deve consumir o endpoint de streaming e atualizar a UI de forma incremental.

---

### 4) Ranking de entidades críticas

Exibir o ranking de entidades críticas retornado pela API.

---

## Requisitos técnicos esperados

### Backend

- Node.js ou PHP Laravel;
- Se for utilizar Node.js, deve usar TypeScript e é permitido utilizar qualquer framework;
- Se for utilizar o PHP Laravel, deve utilizar o Laravel 13;
- Banco relacional, preferencialmente PostgreSQL ou MySQL;
- Código organizado e com separação clara de responsabilidades.

---

### Frontend

- Next.js;
- TypeScript;
- Organização clara de componentes;
- Separação entre UI, estado e chamadas de API;
- Tratamento de loading, erro e estado vazio.

---

## Arquitetura e organização

Esperamos ver:

- controllers/handlers simples, sem regra de negócio pesada;
- boa separação de responsabilidades;
- código fácil de entender e evoluir;
- decisões técnicas conscientes e explicáveis.

---

## Performance

Esperamos que você:

- pense em índices, agregações e consultas eficientes;
- considere impacto das decisões em cenários de alto volume.

---

## Concorrência e consistência

Esperamos que você:

- trate race conditions de forma explícita;
- garanta comportamento correto sob carga;
- use estratégias compatíveis com o banco e a arquitetura escolhida;
- explique as decisões tomadas.

---

## Streaming e tempo real

Esperamos que você:

- implemente uma estratégia funcional de atualização em tempo real;
- explique a escolha entre SSE, WebSocket ou outra abordagem;
- trate múltiplos clientes conectados;
- considere reconexão, duplicidade e consistência da UI.

---

## Testes

Implemente testes para os fluxos principais.

Os testes devem validar regras de negócio, não apenas status HTTP.

---

## Documentação

Inclua um `README.md` explicando:

- como rodar o projeto;
- principais decisões técnicas;
- estratégia de concorrência e idempotência;
- como funciona o streaming;
- pontos de atenção sobre performance;
- o que você faria diferente em um cenário real de produção.

---

## Diferenciais

Não são obrigatórios, mas podem demonstrar maturidade técnica:

- Docker;
- filas;
- cache;
- paginação;
- filtros;
- reconexão automática no streaming;
- atualização otimista ou incremental da UI;
- logs estruturados;
- métricas simples;
- testes de frontend.

---

## O que vamos avaliar

### Backend

- clareza e organização do código;
- separação de responsabilidades;
- qualidade das decisões técnicas;
- preocupação com performance;
- tratamento de concorrência e consistência;
- capacidade de explicar comportamento sob carga.

### Frontend

- organização dos componentes;
- clareza do fluxo de dados;
- consumo correto da API;
- tratamento de loading, erro e estado vazio;
- uso correto de streaming;
- experiência mínima de uso.

### Fullstack

- coerência entre backend e frontend;
- entendimento do fluxo completo;
- capacidade de manter a interface consistente com eventos em tempo real;
- clareza ao explicar decisões e trade-offs.

---

## Por fim

Este desafio:

- usa um domínio totalmente fictício;
- não será reaproveitado em nenhum produto real;
- existe exclusivamente para fins avaliativos.

Queremos entender como você pensa como engenheiro(a).

Que a Força esteja com você — e nos vemos na conversa do segundo dia.
