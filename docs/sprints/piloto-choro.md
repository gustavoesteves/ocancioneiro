# Plano de desenvolvimento — piloto editorial de Choro

**Status:** proposta executável
**Documento normativo:** [Especificação editorial v1](../especificacao-editorial-v1.md)
**Glossário:** [Glossário editorial v1](../glossario-editorial-v1.md)
**Vocabulários iniciais:** [Vocabulários editoriais v1](../vocabularios-editoriais-v1.md)
**Horizonte:** Sprint 0, Sprint 1 fatiado em 1A–1G, e Sprints 2–7
**Resultado esperado:** provar o método editorial e a arquitetura com uma
amostra controlada antes de ampliar o acervo

## 1. Objetivo do programa

O piloto deve demonstrar que O Cancioneiro consegue:

1. registrar uma obra antes de existir partitura;
2. documentar por que ela pertence ou não ao repertório canônico;
3. relacionar fontes, evidências e decisões sem reduzi-las a uma pontuação;
4. produzir um lead sheet que preserve identidade, não performance;
5. registrar inferências e emendas de forma localizada;
6. impedir publicação e download quando direitos não estiverem liberados;
7. gerar o catálogo público sem transformar artefatos gerados em fonte de
   verdade;
8. preservar histórico ao revisar, substituir ou retirar uma edição.

O piloto não pretende fechar o cânone do Choro. Ele valida o método que será
usado para investigar Choro e, depois, outras tradições.

## 2. Estado inicial confirmado

O sistema atual possui uma base funcional que deve ser preservada durante a
migração:

- MusicXML em `public/musicxml/`;
- metadados editoriais simples em `data/editorial.json`;
- catálogo público gerado em `public/catalog.json`;
- gerador e validador em `scripts/generate-catalog.mjs`;
- contrato público validado em `lib/catalog.mjs`;
- importação, edição e exclusão locais por `/import` e `/api/import`;
- renderização, busca, filtros, impressão, download e playback;
- `npm run check` como porta de qualidade.

Limitações que motivam o programa:

- toda música pública exige MusicXML;
- obra, edição e arquivo são representados como um único registro `Song`;
- `source` é texto singular e sem proveniência estruturada;
- não existem evidências, afirmações canônicas ou histórico de decisões;
- direitos não controlam exibição, impressão, playback ou download;
- excluir o arquivo local também remove o registro editorial corrente;
- o catálogo público não diferencia metadados disponíveis de partitura
  publicável.

## 3. Estratégia de entrega

### 3.1 Migração incremental

Não haverá reescrita completa. Cada sprint deve manter o sistema utilizável e
fornecer compatibilidade até a interface migrar.

Sequência de dados:

```text
registros editoriais estruturados
        ↓ validação
projeção de catálogo público
        ↓ consumo
interface existente ou interface migrada
```

O catálogo público continua gerado. Nenhuma funcionalidade deve passar a editar
`public/catalog.json` diretamente.

### 3.2 Sprints orientados a portas

O número de dias é secundário. Um sprint termina quando seus critérios de saída
estão satisfeitos. Itens incompletos não são promovidos apenas para cumprir uma
data.

### 3.3 Política de compatibilidade

- mudanças de schema exigem `schemaVersion` e migração;
- o importador atual permanece funcional até existir substituto validado;
- campos antigos não são descartados sem mapeamento verificável;
- a projeção pública aceita temporariamente o contrato antigo;
- alterações destrutivas de dados exigem backup, teste de restauração e
  aprovação explícita;
- fixtures reais nunca dependem de material cuja distribuição não esteja
  autorizada;
- assets ainda não liberados não entram no repositório público; o piloto usa
  material autorizado, fixtures sintéticas ou área privada aprovada.

## 4. Papéis

| Papel | Responsabilidade |
| --- | --- |
| Responsável editorial | aprovar política, recorte e decisões canônicas |
| Pesquisador | localizar fontes e redigir evidências verificáveis |
| Editor musical | produzir e justificar o lead sheet |
| Revisor musical | conferir fontes, MusicXML e decisões localizadas |
| Responsável por direitos | definir permissões por ação e registrar fundamento |
| Desenvolvimento | contratos, validação, geração, interface e migração |
| QA editorial/técnico | executar casos, fixtures, regressões e auditoria |

Uma pessoa pode acumular papéis, mas o registro deve indicar em qual capacidade
ela atuou. Revisão independente é preferível para aceitação canônica e edição
musical.

## 5. Definition of Ready

Um item pode entrar em sprint quando:

- possui resultado observável;
- identifica entidade e contrato afetados;
- informa dependências e riscos;
- tem critérios de aceite verificáveis;
- define material de teste permitido;
- não depende de decisão editorial ainda sem responsável;
- separa mudança de schema, migração e alteração visual quando necessário.

## 6. Definition of Done

Um item está concluído quando:

- implementação e documentação concordam;
- validações de entrada falham de forma explícita e útil;
- migrações preservam os dados e podem ser repetidas com o mesmo resultado;
- testes cobrem caminho feliz, estado parcial, conflito e dado inválido;
- `npm run check` passa;
- artefatos gerados estão sincronizados;
- não há regressão no importador e catálogo existentes, salvo mudança aprovada;
- direitos bloqueiam por padrão o que não foi explicitamente liberado;
- decisões editoriais e revisões deixam trilha de auditoria;
- nenhum arquivo do usuário ou dado fora do escopo foi sobrescrito.

## 7. Visão geral

| Sprint | Resultado principal | Porta de saída |
| --- | --- | --- |
| 0 | especificação editorial aprovada | termos e casos de teste sem ambiguidades críticas |
| 1A | decisão arquitetural de persistência | formato inicial escolhido e riscos aceitos |
| 1B | vocabulários e schemas mínimos | termos controlados validam fixtures reais e inválidas |
| 1C | dossiê mínimo de obra | obra pode existir sem MusicXML |
| 1D | projeção para catálogo legado | catálogo atual é gerado a partir do modelo novo |
| 1E | assets e MusicXML versionados | arquivo deixa de ser identidade da obra |
| 1F | migração do acervo atual | dados atuais migram sem perda e com relatório humano |
| 1G | importador migrado | `/import` edita obra, edição e asset sem duplicar entidades |
| 2 | amostra controlada do Choro | 15–20 candidatos representam os casos necessários |
| 3 | matriz documental completa | fontes e evidências são rastreáveis e revisáveis |
| 4 | bancada editorial operacional | decisões canônicas contextuais possuem histórico |
| 5 | lead sheets piloto | 3–5 edições passam revisão musical e técnica |
| 6 | publicação governada por direitos | metadados, partitura e downloads são liberados separadamente |
| 7 | retrospectiva e modelo estabilizado | expansão aprovada ou lacunas devolvidas ao backlog |

---

## Sprint 0 — Especificação editorial v1

### Objetivo

Converter a discussão conceitual em regra normativa suficiente para orientar
modelagem, pesquisa, edição e publicação.

### Entregáveis

- especificação editorial v1 aprovada;
- glossário de termos controlados;
- vocabulário inicial de centralidade, alcance, linguagens, tradições e papéis;
- política de lead sheet e teste de essencialidade;
- política de direitos com bloqueio seguro;
- cinco a oito casos editoriais de teste;
- registro das decisões abertas, responsáveis e prazo de revisão.

### Casos mínimos de teste

A bancada deve selecionar casos que representem:

- obra nuclear nacional e dentro do Choro;
- obra nuclear na comunidade do Choro, mas menos ampla nacionalmente;
- obra historicamente importante com circulação prática atual menor;
- obra com versões cantada e instrumental;
- obra com divergência melódica ou harmônica entre fontes;
- obra com introdução famosa pertencente a arranjo posterior;
- obra sem direitos de publicação verificados;
- obra em domínio público cuja edição moderna continua protegida.

### Tarefas de desenvolvimento

- [x] adicionar verificação automática de links internos da documentação;
- [x] definir formato do glossário e dos vocabulários versionados;
- [ ] registrar decisões arquiteturais necessárias ao Sprint 1;
- [ ] documentar mapeamento preliminar dos campos atuais para o modelo-alvo;
- [ ] definir política para identificadores estáveis e aliases.

### Tarefas editoriais

- [ ] aprovar definição do Cancioneiro;
- [ ] aprovar o que entra e não entra no lead sheet;
- [ ] decidir nomes finais dos níveis de centralidade;
- [ ] aprovar critérios e tipos de testemunho de repertório;
- [ ] decidir requisitos mínimos de revisão;
- [ ] aprovar política para autoria contestada, letras e títulos alternativos.

### Critérios de aceite

- os casos mínimos podem ser descritos sem colocar obra, edição e arquivo na
  mesma entidade;
- centralidade é contextual e alcance não funciona como ranking;
- nenhuma decisão canônica depende de score automático;
- inferência e emenda editorial são distinguíveis;
- os estados de curadoria, edição e direitos não se inferem entre si;
- termos ainda abertos estão explicitamente marcados, sem valores improvisados
  no código.

### Fora de escopo

- alterar schema de produção;
- produzir MusicXML novo;
- criar interface editorial;
- publicar obras do piloto.

### Riscos e mitigação

- **Taxonomia excessiva:** começar com vocabulário mínimo e versionado.
- **Discussão sem conclusão:** prazo e responsável para cada decisão aberta.
- **Termos ambíguos:** cada termo precisa de definição e contraexemplo.

---

## Sprint 1A — Decisão arquitetural de persistência

### Objetivo

Escolher o formato inicial de persistência editorial antes de escrever schemas
ou migrar dados. A decisão deve favorecer revisão humana, histórico em Git e
migração incremental.

### Opções obrigatórias

A ADR deve comparar pelo menos:

1. arquivos normalizados por entidade;
2. dossiê único por obra com entidades aninhadas;
3. armazenamento relacional, se houver necessidade demonstrada.

A decisão deve considerar revisão em Git, atomicidade da ferramenta local,
consultas, duplicação de fontes, migração e escala esperada. Não introduzir
banco de dados apenas por antecipação.

### Entregáveis

- ADR aprovada em `docs/adr/`;
- decisão sobre extensão e formato dos arquivos editoriais;
- política para IDs estáveis e aliases públicos;
- regra de onde ficam artefatos gerados e fontes de verdade;
- riscos aceitos e critérios que fariam a decisão ser revista.

### Critérios de aceite

- a decisão permite representar obra sem MusicXML;
- a decisão não exige banco de dados para o piloto;
- revisão por diff em Git é viável;
- rollback não destrutivo é possível;
- o catálogo público permanece artefato gerado;
- há caminho claro para deduplicar fontes quando o volume justificar.

### Fora de escopo

- implementar schemas;
- migrar dados reais;
- alterar `/import`;
- alterar a interface pública.

---

## Sprint 1B — Vocabulários e schemas mínimos

### Objetivo

Definir os vocabulários controlados e os contratos mínimos que permitirão
persistir o piloto sem campos genéricos de escape.

### Contratos mínimos nesta etapa

- `Work`;
- `Source` e `SourceUse`;
- `Evidence` e ligações com fontes;
- `CurationRecord`, `CanonicalClaim` e `EditorialDecision`;
- `MusicEdition` e `MusicEditorialDecision`;
- `Asset`;
- `RightsAssessment` e permissões por ação;
- `PublicCatalogEntry` como projeção.

### Regras técnicas iniciais

- todo documento possui `schemaVersion`;
- IDs não dependem de caminho de arquivo;
- referências quebradas falham na validação;
- enums desconhecidos falham com mensagem localizada;
- datas usam formato ISO 8601;
- strings normalizadas não apagam grafia editorial;
- exclusão de um asset não apaga obra, curadoria ou histórico;
- obra sem edição e obra sem asset são estados válidos;
- o gerador público omite ou bloqueia ações conforme direitos.

### Tarefas

- [ ] definir vocabulários versionados para status, centralidade, alcance,
  linguagens, tradições, papéis, tipos de fonte, tipos de evidência, direção,
  força, direitos e ações públicas;
- [x] escrever primeiro validador de fronteira para dossiê editorial;
- [x] criar fixtures válidas e inválidas para o dossiê mínimo;
- [x] garantir que enums desconhecidos falhem com mensagem útil;
- [ ] documentar campos ainda abertos, sem improvisá-los no código;
- [ ] adicionar verificação automática de links internos da documentação;
- [ ] mapear os campos atuais para o modelo-alvo sem executar migração.

### Testes obrigatórios

- obra válida sem edição;
- fonte compartilhável, ainda que a deduplicação global fique para depois;
- evidência sustentada por múltiplas fontes;
- referência inexistente;
- ID duplicado;
- enum inválido;
- direitos não avaliados bloqueando ações públicas por padrão;
- documento com `schemaVersion` ausente.

### Critérios de aceite

- todos os contratos falham fechados diante de dados inválidos;
- os casos mínimos do Sprint 0 cabem nos schemas;
- termos controlados possuem definição e contraexemplo quando necessário;
- obra, curadoria, edição, asset e direitos permanecem independentes;
- nenhum schema exige MusicXML para existir obra.

### Fora de escopo

- gerar catálogo público a partir do modelo novo;
- migrar o acervo atual;
- interface de edição;
- transcrição musical.

---

## Sprint 1C — Dossiê mínimo de obra

### Objetivo

Persistir uma obra candidata ou aceita sem exigir edição musical, MusicXML ou
arquivo publicável.

### Entregáveis

- layout físico do dossiê mínimo conforme a ADR;
- fixtures de obras candidatas, aceitas, rejeitadas e inconclusivas;
- registro de autoria, títulos alternativos, notas de identidade e curadoria;
- direitos mínimos para exibir metadados;
- validador e relatório de inconsistências.

### Tarefas

- [x] implementar leitura e validação de dossiês mínimos;
- [x] criar fixtures de obras candidatas, aceitas, rejeitadas e inconclusivas;
- [x] derivar estado de curadoria a partir de decisão vigente quando houver;
- [x] permitir ausência explícita de edição e asset;
- [x] validar autoria e papéis sem supor dados ausentes;
- [x] gerar relatório de obras sem decisão, sem direitos ou com campos
  legados pendentes.

### Critérios de aceite

- uma obra sem MusicXML é persistida e validada;
- direitos de metadados podem ser registrados sem liberar partitura;
- ausência de edição aparece como estado normal;
- nenhuma exclusão de arquivo apaga o dossiê;
- fixtures cobrem estado parcial e dado inválido.

### Fora de escopo

- produzir catálogo legado;
- importar MusicXML para o modelo novo;
- criar interface pública para obra sem partitura.

---

## Sprint 1D — Projeção para catálogo legado

### Objetivo

Gerar o `public/catalog.json` atual a partir do modelo novo para manter a
interface existente funcionando durante a transição.

### Migração inicial considerada

Mapeamento provisório:

| Campo atual | Destino inicial |
| --- | --- |
| `id` | alias público ligado ao ID estável da obra/edição |
| `title`, `composer` | obra, com proveniência do MusicXML a revisar |
| `genre`, `tags` | classificação legada, não taxonomia canônica automática |
| `level` | metadado da edição ou uso pedagógico, não da obra |
| `source` | fonte legada não estruturada, marcada para revisão |
| `notes` | nota legada; exige classificação antes da migração final |
| `key` | edição/asset, nunca obra |
| `musicxml`, `sourceHash` | asset e integridade |
| `chords`, `instrumentation` | projeção derivada do MusicXML |

### Tarefas

- [x] adaptar o gerador para produzir o catálogo legado durante a transição;
- [x] impedir publicação de asset sem decisão de direitos compatível;
- [x] garantir equivalência do catálogo legado para dados já publicados;
- [x] validar que obra sem asset não aparece como partitura publicável;
- [x] manter `public/catalog.json` como artefato gerado;
- [x] documentar rollback não destrutivo.

### Rollback não destrutivo

Durante a transição, o gerador continua lendo `public/musicxml` e
`data/editorial.json`. Dossiês editoriais são apenas uma fonte adicional: se
uma projeção publicável gerar o mesmo `id` ou o mesmo `musicxml` de uma entrada
legada, a projeção substitui a entrada escaneada. Para reverter sem apagar
dados, basta remover temporariamente o asset publicável do dossiê, mudar seu
estado para `pendente`/`bloqueado` ou retirar uma das permissões públicas
necessárias; o próximo `npm run catalog:generate` volta a publicar a entrada
legada escaneada do MusicXML.

### Testes obrigatórios

- obra aceita sem MusicXML;
- edição válida sem asset publicável;
- catálogo legado equivalente para dados já publicados;
- direitos não verificados bloqueando download.

### Critérios de aceite

- o catálogo público atual pode ser regenerado;
- a tela principal continua funcionando sem conhecer o modelo novo;
- ações públicas são omitidas ou bloqueadas conforme direitos;
- a projeção é determinística;
- `npm run check` passa com os dois modelos.

### Fora de escopo

- migrar `/import`;
- substituir a interface pública;
- transcrição musical.

---

## Sprint 1E — Assets e MusicXML versionados

### Objetivo

Separar o arquivo MusicXML da identidade da obra e da edição musical,
registrando versão, checksum, validação e permissões.

### Entregáveis

- contrato `Asset`;
- vínculo entre asset e edição;
- cálculo de checksum com algoritmo identificado;
- validação de MusicXML publicável;
- estado de asset: `pendente`, `valido`, `inconsistente` ou `substituido`;
- política de substituição sem sobrescrita silenciosa.

### Tarefas

- [x] calcular e validar checksum;
- [x] registrar ferramenta e data de geração;
- [x] validar metadados do MusicXML contra obra e edição;
- [x] validar presença de `<harmony>` quando a edição declara cifras;
- [x] versionar substituição de asset;
- [x] preservar asset anterior ou referência de auditoria conforme política;
- [x] impedir asset não liberado em pacote público.

### Critérios de aceite

- arquivo deixa de determinar ID da obra;
- substituição cria nova versão ou estado rastreável;
- asset bloqueado não entra no build público;
- MusicXML inválido falha antes de publicação;
- download não é habilitado sem permissão explícita.

### Fora de escopo

- editar decisões musicais localizadas;
- transcrever novas obras;
- criar visualizador de versões.

---

## Sprint 1F — Migração do acervo atual

### Objetivo

Migrar os dados atuais para o modelo novo de forma determinística, preservando
o catálogo público e emitindo pendências de revisão humana.

### Tarefas

- [x] implementar migração repetível do formato atual;
- [x] gerar relatório de campos legados que exigem revisão humana;
- [x] preservar aliases públicos existentes;
- [x] migrar `source` como fonte legada não estruturada;
- [x] migrar `notes` com classificação pendente;
- [x] validar round-trip de geração do catálogo legado;
- [x] documentar rollback não destrutivo.

### Rollback não destrutivo

A primeira etapa da migração é uma transformação pura do catálogo legado para
dossiês editoriais em memória. Nenhum arquivo do acervo é alterado por essa
camada. Para reverter, basta continuar usando `public/catalog.json` gerado pelo
fluxo legado e ignorar os dossiês migrados até que a etapa de escrita em disco
seja explicitamente habilitada.

### Comando operacional

O comando `npm run dossiers:migrate` executa uma simulação da migração e lista
os dossiês que seriam criados ou atualizados. `npm run dossiers:migrate --
--check` falha se houver migração pendente. A escrita em disco só acontece com
`npm run dossiers:migrate -- --write`. A simulação também audita o asset
legado: se o MusicXML estiver ausente ou se `sourceHash` divergir do arquivo, a
pendência aparece no relatório antes de qualquer gravação. Em ensaios com
catálogos fora do workspace, `--project-root` define a raiz usada para resolver
caminhos públicos como `/musicxml/...`.

### Testes obrigatórios

- migração repetida sem alteração adicional;
- campo legado vazio;
- MusicXML ausente;
- arquivo movido com alias preservado;
- `sourceHash` divergente;
- relatório de revisão humana.

### Critérios de aceite

- o acervo atual migra sem perda;
- `public/catalog.json` pode ser regenerado de forma equivalente;
- nenhuma escrita parcial deixa referências quebradas;
- pendências editoriais ficam explícitas;
- rollback foi ensaiado em fixture.

### Fora de escopo

- migrar manualmente o piloto inteiro;
- resolver pendências editoriais;
- alterar experiência pública.

---

## Sprint 1G — Importador migrado

### Objetivo

Adaptar `/import` para editar obra, edição e asset sem criar duplicatas nem
apagar histórico editorial.

### Tarefas

- [x] carregar obras existentes do modelo novo;
- [x] permitir vincular MusicXML a edição existente;
- [x] impedir que importar arquivo crie obra duplicada silenciosamente;
- [x] separar arquivamento editorial de remoção física do asset;
- [x] testar round-trip da ferramenta local;
- [x] bloquear operações ainda não migradas com mensagem explícita.

### Vinculação local

Quando um dossiê editorial é selecionado no `/import`, um novo MusicXML pode
ser gravado como asset desse dossiê. A operação cria/atualiza uma edição
importada controlada, preserva `work.id` e só usa `publicCatalogId` como alias
público da edição/asset.

### Critérios de aceite

- o importador atual permanece funcional ou falha de modo controlado;
- editar asset não altera obra sem confirmação;
- excluir asset preserva dossiê e histórico;
- renomear alias não muda ID estável da obra;
- catálogo público é regenerado após operações permitidas;
- `npm run check` cobre criação, edição, exclusão e conflito.

### Fora de escopo

- interface final de pesquisa editorial;
- matriz documental completa;
- transcrição musical.

---

## Sprint 2 — Amostra controlada do piloto de Choro

### Objetivo

Selecionar 15–20 obras que testem o modelo, não uma lista definitiva do cânone.

### Matriz de seleção

A amostra, como conjunto, deve cobrir:

- formação histórica da linguagem;
- repertório vivo de roda;
- uso pedagógico;
- obras instrumentais e cantadas;
- diferentes gerações e autores;
- circulação nacional, regional e comunitária;
- centralidade nuclear, consolidada e contextual a investigar;
- múltiplas fontes e divergências;
- atribuição ou data controversa;
- domínio público, direitos protegidos e estado desconhecido;
- edição existente, edição ausente e arquivo bloqueado;
- forma simples e forma com elementos essenciais incomuns.

### Entregáveis

- lista de candidatos com justificativa de inclusão no piloto;
- ficha mínima de obra para cada candidato;
- hipótese de contexto canônico, claramente marcada como hipótese;
- mapa de fontes a localizar;
- avaliação inicial de direitos;
- tabela de cobertura da amostra e lacunas assumidas.

### Tarefas

- [ ] criar ficha de candidatura;
- [ ] aplicar IDs estáveis e registrar títulos alternativos;
- [ ] identificar autores e papéis sem resolver controvérsias por suposição;
- [ ] classificar casos técnicos e editoriais representados;
- [ ] registrar obras reserva para substituir candidato inviável;
- [ ] validar que nenhuma seleção depende de disponibilidade imediata do
  MusicXML;
- [ ] revisar a amostra com pelo menos uma pessoa conhecedora da prática do
  Choro, quando possível.

### Critérios de aceite

- a amostra contém entre 15 e 20 obras;
- todos os casos definidos no Sprint 0 estão representados;
- cada candidatura tem objetivo de teste explícito;
- hipóteses não aparecem como decisões aceitas;
- lacunas de representação são visíveis e não corrigidas por cota automática;
- nenhuma obra foi excluída apenas por falta de partitura publicável.

### Fora de escopo

- decisão canônica final;
- transcrição de todas as obras;
- publicação pública da lista como cânone aprovado.

### Riscos e mitigação

- **Amostra formada apenas por casos fáceis:** reservar vagas para conflitos.
- **Viés Rio/choro urbano documentado:** registrar cobertura e consultar outras
  comunidades sem forçar compensação numérica.
- **Confundir exemplo com cânone:** rotular publicamente a etapa como piloto.

---

## Sprint 3 — Matriz documental

### Objetivo

Construir dossiês rastreáveis que permitam à bancada avaliar repertório,
centralidade e alcance.

### Entregáveis

- fontes estruturadas e deduplicadas;
- usos de fonte avaliados por finalidade;
- evidências favoráveis, contraditórias e contextuais;
- testemunhos de repertório;
- lacunas e conflitos explícitos;
- relatório de completude por candidatura.

### Procedimento por obra

1. definir perguntas de pesquisa;
2. localizar fontes primárias e secundárias;
3. registrar fonte e localizador preciso;
4. formular evidência verificável;
5. relacionar evidência aos critérios editoriais;
6. avaliar direção e força com justificativa;
7. procurar evidência contraditória ou limite da afirmação;
8. submeter o dossiê à revisão de pesquisa.

### Qualidade da fonte

O dossiê deve diferenciar:

- existência da fonte;
- proveniência;
- acesso ao item exato;
- adequação ao uso;
- interpretação editorial.

Uma URL genérica para um acervo não prova que a obra está presente nele. O
localizador precisa permitir a conferência do item.

### Tarefas de desenvolvimento

- [ ] validar referências muitos-para-muitos;
- [ ] permitir localizadores por página, faixa, compasso e item de acervo;
- [ ] detectar fontes duplicadas por identificador persistente;
- [ ] emitir relatório de evidência sem fonte;
- [ ] impedir força sem justificativa;
- [ ] suportar direção contraditória;
- [ ] gerar matriz de cobertura com método de contagem explícito;
- [ ] exportar dossiê legível para revisão humana.

### Testes obrigatórios

- uma fonte sustentando várias evidências;
- uma evidência com várias fontes;
- evidências em conflito;
- fonte sem URL, mas com identificador de acervo válido;
- link sem localizador suficiente;
- fonte indisponível após consulta;
- registro de depoimento com responsável e data;
- indicador com categorias múltiplas sem percentual enganoso.

### Critérios de aceite

- toda afirmação factual relevante aponta para fonte conferível;
- toda evidência possui direção, força e justificativa;
- ausência de fonte é mostrada como lacuna, não preenchida por padrão;
- cada candidatura possui pelo menos duas linhas independentes de evidência ou
  uma decisão explícita de insuficiência;
- dossiês podem ser revisados sem abrir o código da aplicação;
- nenhum material protegido foi copiado sem autorização.

### Fora de escopo

- transformar evidência em score;
- decidir automaticamente a entrada no cânone;
- produzir partituras.

---

## Sprint 4 — Bancada editorial e decisões canônicas

### Objetivo

Transformar dossiês revisados em decisões canônicas contextualizadas e
auditáveis.

### Entregáveis

- pauta e protocolo de bancada;
- decisões para a amostra ou estado `inconclusiva` justificado;
- afirmações canônicas por contexto;
- centralidade e alcance sem hierarquia indevida;
- votos ou pareceres divergentes preservados;
- histórico de revisão e próxima data de reavaliação;
- visão de cobertura do piloto.

### Fluxo

```text
em_pesquisa
    ↓ dossiê revisado
em_revisao
    ↓ bancada
aceita | rejeitada | inconclusiva
    ↓ nova evidência relevante
nova revisão, sem apagar a decisão anterior
```

### Tarefas de desenvolvimento

- [ ] implementar registro imutável de decisão;
- [ ] derivar estado atual da decisão vigente;
- [ ] permitir múltiplas afirmações canônicas por obra;
- [ ] exigir contexto, justificativa e evidências relacionadas;
- [ ] registrar revisores e conflitos de interesse;
- [ ] impedir alteração retroativa de decisão publicada;
- [ ] gerar diff legível entre revisões;
- [ ] criar relatório de decisões sem revisão independente.

### Critérios de aceite

- nenhuma obra é aceita por score ou por voto sem justificativa;
- uma obra pode ser nuclear no Choro e consolidada nacionalmente;
- alcance regional ou comunitário não reduz centralidade automaticamente;
- divergências permanecem no histórico;
- o catálogo público só apresenta como canônica uma afirmação vigente aceita;
- o sistema representa obra aceita sem edição musical.

### Fora de escopo

- interface pública definitiva da curadoria;
- produzir lead sheet para toda obra aceita;
- estabelecer ranking de compositores ou obras.

---

## Sprint 5 — Lead sheets piloto

### Objetivo

Produzir de três a cinco edições completas que exercitem fontes, decisões
localizadas, revisão musical e geração técnica.

### Seleção das edições

O conjunto deve incluir:

- uma obra com fonte escrita principal;
- uma obra cuja harmonia dependa de gravação;
- uma divergência entre fontes;
- ao menos uma inferência localizada;
- ao menos um elemento candidato ao teste de essencialidade;
- estados de direitos compatíveis com uso interno ou publicação prevista.

### Entregáveis por edição

- fontes adotadas por melodia, forma e harmonia;
- tonalidade da fonte e tonalidade codificada;
- lead sheet MusicXML;
- decisões editoriais localizadas;
- alternativas e confiança nos trechos ambíguos;
- elementos essenciais justificados;
- práticas de performance documentadas fora da partitura;
- revisão musical;
- asset com checksum e validação;
- avaliação de direitos por ação.

### Tarefas de desenvolvimento

- [ ] estender o fluxo local para vincular MusicXML a uma edição existente;
- [ ] impedir que importar arquivo crie silenciosamente uma obra duplicada;
- [ ] exibir fontes e decisões relevantes durante revisão;
- [ ] validar metadados do MusicXML contra obra e edição;
- [ ] validar presença e forma dos elementos `<harmony>`;
- [ ] permitir localizador musical em decisões;
- [ ] calcular checksum com algoritmo identificado;
- [ ] versionar substituição de asset;
- [ ] preservar arquivo anterior ou referência de auditoria conforme política;
- [ ] gerar relatório de conteúdo potencialmente fora do escopo do lead sheet.

### Checklist musical

- [ ] uma pauta principal, salvo exceção aprovada;
- [ ] melodia conferida contra fontes adotadas;
- [ ] cifras representam harmonia editorial, não voicings;
- [ ] forma executável sem instruções de arranjo;
- [ ] repetições e codas consistentes;
- [ ] introduções e finais submetidos ao teste de essencialidade;
- [ ] inferências e emendas registradas;
- [ ] transposição documentada quando houver;
- [ ] renderização e playback usados como verificação, não como prova editorial.

### Testes obrigatórios

- MusicXML inválido;
- metadados divergentes da obra;
- decisão apontando para compasso inexistente;
- checksum divergente;
- substituição criando nova versão;
- harmonia ambígua com alternativa;
- emenda sem justificativa;
- elemento não essencial detectado na revisão;
- asset sem direitos publicáveis.

### Critérios de aceite

- três a cinco edições passam por editor e revisor;
- cada escolha não trivial é rastreável;
- o MusicXML permanece lead sheet, não arranjo;
- arquivos anteriores não são silenciosamente sobrescritos;
- `npm run check` cobre as novas validações;
- nenhuma edição é publicada apenas porque tecnicamente renderiza.

### Fora de escopo

- transcrever todas as obras aceitas;
- acompanhamento automático a partir das cifras;
- edição crítica completa ou fac-símile;
- arranjos por formação instrumental.

---

## Sprint 6 — Validação, direitos e publicação

### Objetivo

Publicar somente informações e ações explicitamente permitidas, mantendo úteis
os registros canônicos sem partitura disponível.

### Entregáveis

- matriz de direitos por objeto e ação;
- projeção pública com estados de disponibilidade;
- interface para obra sem edição;
- interface para partitura bloqueada;
- controles independentes de exibição, playback, impressão e download;
- logs de geração e publicação sem dados sensíveis;
- documentação operacional e rollback.

### Contrato público mínimo

O catálogo deve conseguir representar:

- obra com metadados e sem edição;
- edição em revisão, não pública;
- edição válida, mas bloqueada por direitos;
- partitura exibível por artefato cuja forma de entrega esteja autorizada;
- MusicXML distribuível;
- asset substituído que não deve aparecer como vigente.

Campos exatos serão definidos no Sprint 1, mas a interface não deve inferir
permissão pela existência de uma URL. Na arquitetura estática atual, exibir ou
executar playback a partir de MusicXML também entrega o arquivo ao navegador;
não existe bloqueio técnico de download apenas por esconder um botão.

### Tarefas de desenvolvimento

- [ ] implementar política deny-by-default;
- [ ] calcular permissões efetivas considerando como cada asset é entregue;
- [ ] separar URL interna de permissão pública;
- [ ] impedir acesso direto a asset bloqueado no artefato publicado;
- [ ] impedir que asset não liberado seja commitado no repositório público;
- [ ] adaptar busca para registros sem MusicXML;
- [ ] adaptar seleção ativa para obra sem partitura;
- [ ] mostrar motivo editorial de indisponibilidade sem expor informação
  jurídica interna;
- [ ] condicionar playback, impressão e download separadamente;
- [ ] validar que o build não empacota arquivos bloqueados;
- [ ] adicionar teste de regressão para caminhos públicos seguros;
- [ ] documentar procedimento de retirada emergencial;
- [ ] verificar catálogo e site publicados após deploy controlado.

### Segurança e privacidade

- não publicar pareceres jurídicos internos, contatos ou documentos de licença;
- não confiar apenas em esconder botões: assets bloqueados não entram no pacote
  público nem no repositório público;
- validar todos os dados estruturados na fronteira;
- escapar conteúdo editorial exibido;
- manter ferramenta de escrita restrita ao ambiente local;
- registrar falhas de publicação sem vazar caminhos ou credenciais.

### Testes obrigatórios

- asset bloqueado ausente do build;
- URL manual de asset bloqueado não resolve;
- metadados permitidos sem partitura;
- restrição de impressão com exibição permitida é identificada como limite de
  interface, não como garantia técnica;
- combinação “playback permitido” e “distribuição MusicXML bloqueada” é rejeitada
  na arquitetura estática ou usa artefato derivado explicitamente autorizado;
- mudança de direito invalidando projeção anterior;
- catálogo com mistura de todos os estados;
- retirada emergencial preservando histórico interno.

### Critérios de aceite

- nenhuma ação é habilitada por omissão;
- permissões incompatíveis com a forma de entrega falham antes do build;
- obra aceita permanece navegável quando a partitura está indisponível, se a
  política de metadados permitir;
- o pacote publicado não contém arquivos bloqueados;
- a interface comunica estados sem prometer direito inexistente;
- build, testes e verificação pós-publicação passam;
- rollback foi ensaiado com fixture não protegida.

### Fora de escopo

- automatizar decisão jurídica;
- publicar o piloto completo;
- abrir ferramenta editorial de escrita na internet.

---

## Sprint 7 — Retrospectiva e estabilização

### Objetivo

Determinar se o modelo está pronto para escalar o Choro e depois outras
tradições, corrigindo problemas antes da produção em massa.

### Perguntas obrigatórias

- O modelo explicou todos os casos difíceis sem campos genéricos de escape?
- Conseguimos distinguir fato, interpretação, inferência e emenda?
- A bancada entendeu centralidade contextual e alcance não hierárquico?
- A pesquisa conseguiu reencontrar todas as fontes?
- O tempo de cadastro é sustentável?
- A ferramenta evitou duplicação de obra, fonte e edição?
- Algum arquivo foi publicável tecnicamente, mas bloqueado corretamente?
- A interface tratou obra sem partitura como estado normal?
- O catálogo legado pode ser descontinuado ou ainda precisa de compatibilidade?
- Quais partes são específicas do Choro e quais são reutilizáveis?

### Entregáveis

- relatório de retrospectiva;
- lista de mudanças na especificação com impacto de migração;
- versão estabilizada dos schemas;
- dívida técnica e editorial priorizada;
- métricas de cobertura com método explícito;
- plano de expansão do Choro;
- critérios para escolher a próxima tradição;
- decisão formal de `expandir`, `repetir piloto` ou `interromper e redesenhar`.

### Métricas úteis

- tempo por ficha de obra, fonte, evidência e edição;
- percentual de afirmações com revisão independente;
- referências quebradas ou não reencontradas;
- decisões reabertas por modelo insuficiente;
- trechos de baixa confiança por edição;
- assets bloqueados corretamente pelo gate;
- erros capturados antes e depois do build;
- distribuição da amostra por contexto, não como meta de cota.

### Critérios de aceite

- problemas críticos possuem correção ou decisão explícita;
- migrações necessárias foram testadas;
- não existem mudanças silenciosas em decisões ou edições publicadas;
- a equipe consegue repetir o fluxo sem conhecimento informal indispensável;
- a expansão só é aprovada se direitos, pesquisa e revisão forem sustentáveis;
- o backlog diferencia claramente conteúdo, ferramenta e governança.

### Fora de escopo

- iniciar automaticamente outra tradição;
- importar centenas de MusicXML;
- considerar o cânone encerrado.

## 8. Backlog transversal

Itens atravessam sprints, mas devem ser vinculados a um critério de saída.

### Contratos e migrações

- schemas versionados;
- relatórios de migração;
- aliases de IDs;
- resolvedor de referências;
- compatibilidade temporária do catálogo;
- política de arquivamento e restauração.

### Qualidade

- fixtures sintéticas para casos protegidos;
- testes unitários de validadores;
- testes de integração do gerador;
- testes do CRUD local;
- testes do pacote público;
- verificação de links e documentação;
- mensagens de erro acionáveis.

### Governança

- modelo de decisão;
- declaração de conflito de interesse;
- revisão independente;
- periodicidade de reavaliação;
- processo de contestação e correção;
- responsáveis por vocabulários.

### Segurança e direitos

- deny-by-default;
- assets privados fora do build;
- retirada emergencial;
- registro de fundamento sem exposição pública;
- validação de caminhos e referências;
- ferramenta de escrita apenas local.

### Experiência editorial

- visão de pendências;
- comparação de fontes;
- diff de decisões e edições;
- localizadores musicais;
- relatório de cobertura;
- exportação de dossiê para revisão.

## 9. Estratégia de testes por camada

| Camada | Testes principais |
| --- | --- |
| Obra | IDs, autoria, aliases, títulos e referências |
| Curadoria | estados, afirmações contextuais e histórico imutável |
| Fontes | deduplicação, localizadores e proveniência |
| Evidências | direção, força, justificativa e relações muitos-para-muitos |
| Edição | fontes por aspecto, decisões localizadas e versionamento |
| MusicXML | segurança, renderização, harmonia, forma e checksum |
| Direitos | permissões por ação e bloqueio por padrão |
| Catálogo | projeção de estados completos e parciais |
| Interface | obra sem partitura, bloqueios e ausência de falhas silenciosas |
| Build | exclusão de assets bloqueados e artefatos sincronizados |

## 10. Dependências entre sprints

```text
Sprint 0 ──► Sprint 1 ──► Sprint 2 ──► Sprint 3 ──► Sprint 4
                 │                                      │
                 └──────── infraestrutura ──────────────┤
                                                        ▼
Sprint 7 ◄── Sprint 6 ◄── Sprint 5 ◄────────────────────┘
```

Pesquisa exploratória pode começar antes do Sprint 1, mas dados definitivos só
entram depois que contratos e IDs forem aprovados. Lead sheets não começam
antes da decisão de fontes e do gate mínimo de direitos.

## 11. Riscos do programa

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| taxonomia crescer sem controle | dados incomparáveis | vocabulário mínimo, versionado e com responsável |
| fonte singular apagar divergências | decisão editorial frágil | fontes por aspecto e relações muitos-para-muitos |
| MusicXML virar identidade da obra | duplicação e perda de histórico | IDs independentes e asset subordinado à edição |
| disponibilidade orientar o cânone | viés editorial | curadoria antes de partitura |
| score substituir julgamento | falsa objetividade | decisão humana documentada |
| obra regional ser tratada como menor | reprodução de viés histórico | alcance não hierárquico e contexto explícito |
| arquivo protegido entrar no build | exposição jurídica | deny-by-default e teste do pacote |
| CRUD apagar pesquisa | perda irreversível | separar arquivamento de asset e entidade editorial |
| migração quebrar catálogo | indisponibilidade | projeção compatível, fixtures e rollback |
| piloto virar produção massiva | dívida antes da validação | porta formal no Sprint 7 |

## 12. Primeiras issues sugeridas

Ordem recomendada para abrir tarefas após aprovação do Sprint 0:

1. ADR: estratégia de persistência editorial.
2. ADR: identidade estável de obra, edição e asset.
3. Definir schemas v1 e vocabulários controlados.
4. Criar fixtures de estados completos e parciais.
5. Implementar validadores e resolvedor de referências.
6. Mapear e migrar `data/editorial.json` sem escrita destrutiva.
7. Produzir catálogo legado a partir do novo modelo.
8. Separar exclusão de asset de arquivamento da obra.
9. Implementar direitos por ação e gate de build.
10. Criar ficha de candidatura do piloto.
11. Selecionar a amostra de Choro.
12. Implementar fontes, evidências e localizadores.
13. Exportar dossiê humano para revisão.
14. Implementar decisões imutáveis e afirmações contextuais.
15. Adaptar importador para vincular MusicXML a edição.
16. Produzir e revisar as primeiras edições piloto.
17. Adaptar catálogo e interface para obra sem partitura.
18. Validar pacote público contra assets bloqueados.
19. Executar retrospectiva e decidir expansão.

## 13. Condição de encerramento do programa

O piloto termina quando existe evidência de que o método é repetível, não quando
um número arbitrário de partituras foi publicado.

O programa é bem-sucedido se:

- decisões canônicas podem ser justificadas documentalmente;
- edições musicais podem ser auditadas até suas fontes;
- o sistema representa estados parciais sem inconsistência;
- direitos controlam ações reais e o conteúdo do build;
- o catálogo continua útil com ou sem partitura disponível;
- a equipe consegue ampliar o repertório sem depender de memória informal;
- a retrospectiva autoriza explicitamente a próxima escala.
