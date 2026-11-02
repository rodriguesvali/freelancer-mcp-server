# Plano de correções e melhorias

Data: 2026-11-02. Origem: auditoria do freelancer-mcp-server solicitada pelo usuário.

## Objetivo e escopo
Corrigir identificação de conversas, reduzir risco de escrita na conta errada, tratar dependência vulnerável e validações incompletas; depois melhorar contratos, limites de saída e coesão. Entrega desta etapa: planejamento, sem alteração da implementação.

A auditoria encontrou compilação sem erros, ausência de testes/CI versionados e um aviso alto no Zod. Revalidar avisos na execução: dados de segurança mudam. O grafo foi usado como mapa, e os defeitos funcionais foram confirmados no código e em reproduções locais.

## Premissas e decisões propostas
- Manter servidor local via stdio e a separação por domínio; não criar HTTP público, banco de dados ou framework de plugins.
- Usar credenciais fictícias, fixtures sanitizadas e HTTP simulado em todos os testes. Não enviar mensagens, propostas nem editar perfis reais.
- Exigir account nas escritas quando houver múltiplas contas; preservar consultas com default e omissão em instância com conta única.
- Modo somente leitura terá bloqueio central. Seu padrão deve ser decidido antes de T04: recomendar somente leitura por padrão em uma release com migração explícita; mudança silenciosa em patch deve ser evitada.
- Não criar confirmação baseada apenas em argumento booleano enviado pelo próprio modelo. Aprovação humana é responsabilidade do host, salvo futuro fluxo verificável separado.
- Usar limites de payload locais documentados; confirmar restrições da plataforma em fontes oficiais antes de codificá-las como regras da API.
- Refatorações não devem alterar comportamento e ficam separadas dos commits de correção.

## Prioridades e sequência
P0: risco direto ou dependência vulnerável. P1: robustez e proteção operacional. P2: manutenção e coesão.

1. T01 → T02: base de testes e correção urgente do thread.
2. T03: seleção segura de contas. Checkpoint A.
3. T05 → T06 → T07: dependência e entradas. Checkpoint B.
4. T04 → T08 → T09: política de escrita e contratos de resposta. Checkpoint C.
5. T10 → T11: respostas limitadas e atualização de skills. Checkpoint D.
6. T12 → T13: refatorações com caracterização. Checkpoint E.
7. T14 → T15: desenvolvimento reproduzível, CI e revisão final.

Cada tarefa depende das dependências explícitas em todo.md, mesmo quando apresentada em outra fase. T14 pode ser antecipada após T01; a configuração de CI pode começar cedo e ser ampliada até T15. Não agrupar todas as tarefas em um único PR.

## Decisões a resolver na implementação
- Padrão do modo de escrita e release de migração: muda capacidade disponível, portanto precisa constar do contrato público.
- Formatos de links de chat realmente suportados: exemplos documentados viram fixtures; formatos ambíguos devem falhar.
- Suporte de skill_ids vazio pela API: confirmar antes de prometer limpeza; rejeição explícita é alternativa válida.
- Versão corrigida de Zod compatível com SDK: testar migração major e só atualizar SDK se necessário.
- Orçamento total de saída e projeções: propor valor a partir de fixtures representativas e registrar como limite local.
- Confirmar matriz Node suportada e impacto de compatibilidade das mudanças; não usar apenas a versão local como evidência.

## Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Zod major alterar defaults ou schemas do SDK | Testes pelo protocolo MCP e instalação limpa antes de concluir atualização. |
| Conta explícita e modo somente leitura quebrarem automações | Mensagens claras, guia de migração e decisão de versão pública. |
| Validação de resposta rejeitar campos opcionais legítimos | Fixtures verificadas e schemas por endpoint; permitir campos extras na entrada sem devolução automática. |
| Truncamento remover dados necessários ao agente | Metadados de omissão e paginação; testar resposta completa serializada. |
| Refatorações ocultarem regressões | Primeiro caracterizar, depois mover; PRs separados e limite de aproximadamente cinco arquivos por subtarefa. |
| Auditoria de dependências mudar durante execução | Reexecutar auditoria no fechamento e documentar triagem, sem atualização forçada. |

## Verificação e conclusão
Cada tarefa só pode ser marcada após cumprir seus critérios e comandos de verificação. Após cada checkpoint, registrar resultados de testes, compilação e smoke MCP; revisão humana ocorre no fluxo normal do PR, sem exigir uma pausa adicional a cada tarefa.

Concluir quando os defeitos reproduzidos estiverem cobertos por regressão, todas as ferramentas mutáveis respeitarem política/conta, entradas e respostas forem validadas, a saída total for limitada e a CI passar. Não introduzir percentual arbitrário de cobertura: priorizar os casos de abuso e contratos descritos nas tarefas.

## Artefatos e limites
- Lista executável e acompanhamento: tasks/todo.md.
- Implementação, alterações de dependências, commits, merge e publicação não foram realizados nesta etapa.
- A consulta pública a dados de segurança e documentação oficial será refeita nas tarefas correspondentes.
