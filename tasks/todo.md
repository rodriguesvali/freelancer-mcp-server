# Tarefas — correções e melhorias

T01 a T08 foram implementadas; T09 está em andamento e as demais tarefas estão pendentes. P0 = urgente; P1 = robustez; P2 = coesão. Plano e decisões: [plan.md](plan.md).

## T01 [P0]: Criar base mínima de testes

- [x] **Concluir T01**

Criar um harness para registrar e chamar ferramentas MCP com transporte HTTP simulado; preferir node:test e compilação TypeScript existente, sem framework adicional se desnecessário.

**Dependências:** Nenhuma.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `package.json`, `tests/helpers/mcp.ts`, `tests/helpers/http.ts`, `tests/smoke.test.ts`.

**Critérios de aceite:**
- [x] npm test executa testes reais e falha diante de uma asserção inválida.
- [x] Nenhum teste usa tokens reais ou acessa Freelancer; simular sucesso, erro HTTP e timeout.
- [x] Um smoke test inicializa o servidor e lista ferramentas pelo protocolo MCP.

**Verificação:** npm test; npm run build; smoke MCP local.

## T02 [P0]: Corrigir identificação de threads

- [x] **Concluir T02**

Substituir a busca pelo último número por parsing explícito de IDs e URLs; cobrir leitura e envio.

**Dependências:** T01.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/services/api.ts`, `src/tools/messages.ts`, `tests/messages.test.ts`.

**Critérios de aceite:**
- [x] thread/123?page=2 e thread/123?project=456 resolvem para 123; cobrir fragmentos.
- [x] Aceitar apenas IDs inteiros positivos seguros e formatos de URL documentados; rejeitar domínio externo, host semelhante, zero, Infinity e números fora da faixa segura.
- [x] Entrada inválida não gera HTTP; envio válido usa exatamente o thread solicitado.

**Verificação:** Testes de regressão no parser e no handler de envio; npm test; npm run build.

## T03 [P0]: Tornar explícita a conta nas escritas

- [x] **Concluir T03**

Centralizar a seleção de conta por tipo de operação; validar a configuração antes de disponibilizar ferramentas.

**Dependências:** T01.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/services/api.ts`, `src/index.ts`, `src/tools/meta.ts`, `tests/accounts.test.ts`, `README.md`.

**Critérios de aceite:**
- [x] Com múltiplas contas, POST/PUT/DELETE sem account ou com account vazio falham antes do HTTP; com uma conta, preservar a omissão.
- [x] Leituras mantêm o default documentado; conta desconhecida falha e conta explícita usa apenas seu token.
- [x] Configuração multi-conta malformada ou com entradas inválidas falha claramente, sem descartar entradas e continuar com outra conta silenciosamente.

**Verificação:** Matriz de uma/múltiplas contas, erro de configuração e isolamento de headers; npm test; npm run build.

### Checkpoint A — threads e contas

- [ ] Critérios das tarefas aplicáveis cumpridos, suíte e build passando.
- [ ] Smoke MCP com HTTP simulado sem regressões; evidências registradas no PR.
- [ ] Alterações de comportamento documentadas; revisão humana prevista antes de merge.

## T04 [P1]: Definir controle de capacidade de escrita

- [x] **Concluir T04**

Adicionar configuração explícita de somente leitura, com bloqueio central das operações de escrita; documentar que aprovação humana depende do cliente MCP.

**Dependências:** T03.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/index.ts`, `src/services/api.ts`, `tests/write-policy.test.ts`, `README.md`.

**Critérios de aceite:**
- [x] Modo somente leitura bloqueia todas as mutações antes do HTTP e preserva consultas.
- [x] Modo com escrita habilitada permite apenas operações com seleção de conta válida; testar propostas, mensagens, skills e perfis.
- [x] README remove a garantia universal de confirmação e descreve a política, seu padrão e a migração; definir o padrão como decisão de compatibilidade antes de implementar.

**Verificação:** Testes de política cobrindo todas as ferramentas mutáveis; npm test; npm run build.

## T05 [P0]: Corrigir dependência vulnerável

- [x] **Concluir T05**

Revalidar o aviso do Zod e escolher uma versão corrigida compatível com o SDK MCP; atualizar uma dependência direta por vez, sem audit fix --force.

**Dependências:** T01.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `package.json`, `package-lock.json`, `tests/schema-compatibility.test.ts`.

**Critérios de aceite:**
- [x] Registrar versão afetada, aviso atual, alcance e versão corrigida; não presumir que o major atual contém backport.
- [x] Schemas, defaults e registro/listagem/chamada MCP continuam compatíveis; não incluir atualização ampla do SDK sem necessidade comprovada.
- [x] npm audit não apresenta o aviso corrigido; novos avisos alcançáveis altos/críticos são resolvidos ou registrados com justificativa e data de revisão.

**Verificação:** npm ci --ignore-scripts; npm test; npm run build; npm audit; smoke MCP.

Audit: GHSA-mrhx-c7xc-m3w5, Zod 3.25.76 affected; upgraded to 4.6.7. SDK 1.32.2 accepts Zod 4. npm audit reported zero vulnerabilities on 2026-11-02.


## T06 [P1]: Validar skills e listas de perfis

- [x] **Concluir T06**

Validar tipos e limites das coleções antes de resolver nomes ou chamar a API.

**Dependências:** T05.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/tools/account.ts`, `src/schemas/account.ts`, `tests/account-inputs.test.ts`.

**Critérios de aceite:**
- [x] IDs são inteiros positivos seguros; nomes usam trim e rejeitam vazio; listas têm limite explícito documentado.
- [x] Rejeitar números negativos, frações, zero e entradas acima dos limites; preservar deduplicação e erro de nome ambíguo.
- [x] Limitar profile_ids, profile_name, tagline e description com base em documentação oficial; limites locais conservadores devem ser identificados como locais.

**Verificação:** Testes nas fronteiras e entradas inválidas; demonstrar zero HTTP em rejeições; npm test; npm run build.

## T07 [P1]: Completar validação de buscas e valores

- [x] **Concluir T07**

Completar limites e relações entre campos sem ampliar a superfície funcional.

**Dependências:** T05.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/tools/projects.ts`, `src/tools/bids.ts`, `src/tools/messages.ts`, `tests/tool-inputs.test.ts`.

**Critérios de aceite:**
- [x] Orçamentos são finitos, não negativos e min_budget <= max_budget quando ambos existem.
- [x] IDs respeitam a faixa segura; query e thread_id textual têm tamanho máximo; preservar limites já existentes de mensagens e propostas.
- [x] Documentar restrições locais e testar valores no limite, abaixo e acima; não inventar teto monetário da plataforma.

**Verificação:** Testes de schemas e rejeição antes do HTTP; npm test; npm run build.

### Checkpoint B — dependência e entradas

- [ ] Critérios das tarefas aplicáveis cumpridos, suíte e build passando.
- [ ] Smoke MCP com HTTP simulado sem regressões; evidências registradas no PR.
- [ ] Alterações de comportamento documentadas; revisão humana prevista antes de merge.

## T08 [P1]: Validar envelope e respostas de mensagens

- [x] **Concluir T08**

Tratar a resposta HTTP como unknown; validar envelope e estruturas consumidas pelas ferramentas de mensagens.

**Dependências:** T05.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/services/api.ts`, `src/schemas/messages.ts`, `src/tools/messages.ts`, `tests/message-responses.test.ts`.

**Critérios de aceite:**
- [x] Distinguir sucesso, erro da API e resposta malformada; sucesso exige result válido para a operação.
- [x] Validar threads, mensagens e campos necessários antes da formatação; tolerar campos adicionais sem repassá-los automaticamente.
- [x] Erros devolvidos ao MCP não contêm tokens, headers ou stack traces; fixtures inválidas falham de modo previsível.

**Verificação:** Fixtures de sucesso/erro/malformação e teste de não exposição; npm test; npm run build.

## T09 [P1]: Validar respostas dos demais domínios

- [ ] **Concluir T09**

Adicionar schemas por endpoint e vincular a seleção de schema ao transporte central para evitar uma edição ampla de todos os handlers.

**Dependências:** T08.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/schemas/freelancer.ts`, `src/services/api.ts`, `src/types.ts`, `tests/api-contracts.test.ts`.

**Critérios de aceite:**
- [ ] Cobrir self, usuários, projetos, propostas, milestones, catálogo de skills e specialty profiles, inclusive os retornos de escrita.
- [ ] Tipos derivam dos schemas quando possível; cada formatter recebe somente a estrutura validada correspondente.
- [ ] Representar coleções como arrays ou mapas conforme fixtures verificadas; testar campos ausentes e tipos inesperados sem fallback silencioso.

**Verificação:** Testes por família de endpoint com fixtures sanitizadas; npm test; npm run build.

### Checkpoint C — escrita e contratos

- [ ] Critérios das tarefas aplicáveis cumpridos, suíte e build passando.
- [ ] Smoke MCP com HTTP simulado sem regressões; evidências registradas no PR.
- [ ] Alterações de comportamento documentadas; revisão humana prevista antes de merge.

Progresso: schemas por operação, projeção de campos e testes com fixtures sintéticas implementados. Pendente: confrontar formatos com documentação ou fixtures reais sanitizadas e derivar tipos dos schemas; os tipos genéricos atuais não provam a correspondência com o schema.

## T10 [P1]: Limitar a resposta MCP completa

- [ ] **Concluir T10**

Aplicar orçamento ao resultado completo, incluindo structuredContent, por um ponto central; selecionar campos por domínio e informar cortes.

**Dependências:** T09.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/services/mcp-response.ts`, `src/index.ts`, `tests/output-limits.test.ts`, `README.md`.

**Critérios de aceite:**
- [ ] Definir orçamento de bytes serializados para content + structuredContent; todas as ferramentas o respeitam.
- [ ] Truncamento mantém JSON válido e informa campos/itens omitidos e continuidade/paginação quando disponível.
- [ ] Aplicar projeção dos dados retornados; demonstrar que conteúdo grande em structuredContent não contorna o limite textual.

**Verificação:** Testes com mensagens longas, Unicode e coleções grandes; smoke MCP; npm test; npm run build.

## T11 [P1]: Definir semântica de skills vazias

- [ ] **Concluir T11**

Distinguir ausência de skills de uma solicitação explícita de remoção de todas as skills do specialty profile.

**Dependências:** T06.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/tools/account.ts`, `tests/profile-update.test.ts`, `README.md`.

**Critérios de aceite:**
- [ ] Confirmar em documentação oficial ou ambiente de teste se skill_ids vazio limpa as skills; não executar mutações em conta real durante validação.
- [ ] Se suportado, skills: [] envia limpeza explícita; caso contrário, retorna erro claro sem anunciar sucesso.
- [ ] skills omitido preserva as skills e uma lista preenchida substitui conforme contrato; revisar destructiveHint da operação de substituição.

**Verificação:** Testes dos três casos e inspeção do payload simulado; npm test; npm run build.

### Checkpoint D — saída e skills

- [ ] Critérios das tarefas aplicáveis cumpridos, suíte e build passando.
- [ ] Smoke MCP com HTTP simulado sem regressões; evidências registradas no PR.
- [ ] Alterações de comportamento documentadas; revisão humana prevista antes de merge.

## T12 [P2]: Concentrar transporte e serialização

- [ ] **Concluir T12**

Unificar serialização de formulário e repetição de tratamento de erro, preservando contratos de cada endpoint.

**Dependências:** T09.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/services/api.ts`, `src/services/form.ts`, `tests/http-serialization.test.ts`.

**Critérios de aceite:**
- [ ] Um serializador canônico atende apiPost(form) e apiForm; testar arrays, escalares e valores opcionais.
- [ ] Um fluxo central mantém timeout, conta, política de escrita e validação; preservar JSON nos endpoints que o exigem.
- [ ] Caracterização comprova mesmos métodos, caminhos, headers e corpos; nenhuma tentativa automática de repetir escritas não idempotentes é introduzida.

**Verificação:** Comparação de requisições simuladas antes/depois; npm test; npm run build.

## T13 [P2]: Separar responsabilidades dos módulos

- [ ] **Concluir T13**

Separar skills de specialty profiles, mantendo registerAccountTools como fachada temporária se necessário; executar em pequenos commits. Extrair formatação e parsing para módulos próprios em uma segunda subtarefa, com no máximo cinco arquivos por alteração.

**Dependências:** T10, T11, T12.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `src/services/api.ts`, `src/tools/account.ts`, `src/tools/skills.ts`, `src/tools/specialty-profiles.ts`, `src/index.ts`.

**Critérios de aceite:**
- [ ] Ferramentas mantêm nomes, schemas públicos e resultados já corrigidos; snapshot de tools/list permanece equivalente.
- [ ] Transporte não contém formatação nem parsing de links; catálogo e resolução de skills têm um único proprietário.
- [ ] Padronizar opções internas de account, formato e método no transporte, adaptando chamadores em lotes pequenos; remover fachada apenas após eliminar consumidores.

**Verificação:** Testes de caracterização e smoke MCP após cada extração; npm test; npm run build.

### Checkpoint E — coesão

- [ ] Critérios das tarefas aplicáveis cumpridos, suíte e build passando.
- [ ] Smoke MCP com HTTP simulado sem regressões; evidências registradas no PR.
- [ ] Alterações de comportamento documentadas; revisão humana prevista antes de merge.

## T14 [P1]: Tornar desenvolvimento reproduzível

- [ ] **Concluir T14**

Corrigir o comando dev sem depender de ts-node global; preferir build + node ou ferramenta explicitamente declarada e compatível.

**Dependências:** T01.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `package.json`, `README.md`, `tests/dev-command.test.ts`.

**Critérios de aceite:**
- [ ] npm run dev funciona após instalação limpa com versão Node suportada e sem executáveis globais.
- [ ] Sem credenciais, exibe erro esperado de configuração, em vez de falha de loader/comando ausente.
- [ ] README explica como fornecer variáveis; não prometer leitura automática de .env sem implementá-la.

**Verificação:** Instalação limpa sem scripts, inspeção dos scripts necessários e smoke do comando com HTTP simulado; npm run build.

## T15 [P1]: Automatizar verificações e fechar a revisão

- [ ] **Concluir T15**

Adicionar CI e checklist de release, preservando lockfile e evitando depender de verificações manuais de alto risco.

**Dependências:** T02–T14.
**Escopo:** Médio; em T13, cada subtarefa deve respeitar o limite de cinco arquivos.
**Arquivos prováveis:** `.github/workflows/ci.yml`, `package.json`, `README.md`, `PUBLISHING.md`.

**Critérios de aceite:**
- [ ] CI executa instalação congelada com scripts controlados, build, testes, smoke MCP e auditoria; avisos altos/críticos exigem triagem explícita.
- [ ] Definir e testar a matriz Node realmente suportada; alinhar engines e documentação ao resultado, com impacto de versão registrado.
- [ ] Revisão final confirma todos os critérios, orientações de migração e ausência de tokens nos fixtures; sincronizar versões de release se houver publicação futura.

**Verificação:** Executar comandos da CI localmente e validar workflow; revisão humana do diff antes de merge. Publicação fica fora deste plano.

### Checkpoint Final — entrega revisável

- [ ] Critérios das tarefas aplicáveis cumpridos, suíte e build passando.
- [ ] Smoke MCP com HTTP simulado sem regressões; evidências registradas no PR.
- [ ] Alterações de comportamento documentadas; revisão humana prevista antes de merge.
