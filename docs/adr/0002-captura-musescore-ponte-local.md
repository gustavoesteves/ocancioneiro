# ADR 0002 — Captura de MusicXML do MuseScore por ponte local

**Status:** implementado ate promocao transacional local
**Data:** 2026-08-13
**Contexto:** continuidade tecnica apos Sprint 6
**Referencia:** [Sprint 6.1 — Captura segura do MuseScore](../sprints/sprint-06-1-captura-musescore.md)

## Decisao

O Cancioneiro recebera MusicXML diretamente da partitura ativa no MuseScore por
uma **ponte local dedicada ao Cancioneiro**, executada apenas na maquina do
editor. A integracao sera unidirecional no primeiro ciclo: o MuseScore exporta
uma captura; o Cancioneiro nao altera a partitura aberta.

A implementacao reutilizara os conceitos comprovados no projeto Find Chord —
plugin QML, processo local em loopback, arquivo temporario controlado, sessoes,
tokens, correlacao por `requestId`, limite de payload e testes com porta
efemera — sem depender do processo do Find Chord em tempo de execucao.

A captura nao equivale a importacao editorial nem a publicacao. O fluxo sera:

```text
partitura ativa no MuseScore
          |
          v
plugin QML exporta MusicXML para arquivo temporario autorizado
          |
          v
ponte local valida sessao, caminho, tamanho e documento
          |
          v
importador exibe previa, metadados e divergencias
          |
          v
editor vincula a obra e edicao e confirma a captura
          |
          v
asset privado em revisao
          |
          v
validacao editorial + permissao explicita por direitos
          |
          v
promocao atomica para o pacote publico
```

## Fronteiras de responsabilidade

### Plugin do MuseScore

O plugin deve:

- identificar que existe uma partitura ativa;
- solicitar uma sessao efemera a ponte;
- exportar a partitura completa em MusicXML para o caminho temporario fornecido;
- devolver `requestId`, identificador da sessao do plugin e resultado da
  exportacao;
- mostrar falha de exportacao ou indisponibilidade da ponte;
- nunca gravar diretamente em `public/musicxml/`, `data/dossiers/` ou no
  catalogo.

### Ponte local

A ponte deve:

- escutar exclusivamente em endereco de loopback;
- aceitar somente origens locais explicitamente configuradas para o importador;
- usar tokens aleatorios distintos para navegador e plugin;
- validar sessao, origem, caminho real, tipo do arquivo e limite em bytes;
- rejeitar payloads e mensagens fora do contrato versionado;
- correlacionar cada resposta com o `requestId` vigente;
- ler o MusicXML exato, calcular seu SHA-256 e entrega-lo ao importador;
- apagar artefatos temporarios ao encerrar e em recuperacao posterior;
- nao manter catalogo, dossie ou decisao editorial.

### Importador local

O importador deve:

- oferecer `Capturar do MuseScore` como alternativa ao seletor de arquivo;
- alimentar a mesma previa e as mesmas validacoes dos dois modos de entrada;
- exigir escolha explicita de obra e edicao;
- destacar divergencia de titulo, autoria e identidade da partitura ativa;
- preservar o XML capturado antes de qualquer normalizacao;
- criar captura e asset em revisao, nunca edicao editorial valida por omissao;
- tratar repeticao do mesmo hash como operacao idempotente;
- promover o asset somente por uma operacao separada e governada por direitos.

### Publicacao

O gerador e o build devem:

- ignorar capturas privadas e assets em revisao;
- falhar se um asset bloqueado ou nao avaliado estiver no pacote publico;
- exigir edicao valida, asset vigente e permissoes compativeis com a forma de
  entrega;
- preservar a versao anterior ate a promocao completa da substituta;
- permitir retirada sem apagar o historico interno.

## Identidade e proveniencia

O identificador da obra continua sendo `work.id`; o da edicao continua sendo
`edition.id`. Titulo, nome do arquivo, caminho temporario e assinatura parcial
da partitura nao definem identidade editorial.

Cada captura deve registrar, no minimo:

- `captureId` imutavel;
- `requestId` efemero para correlacao operacional;
- data e hora da captura em UTC;
- origem tecnica `musescore_export`;
- versao do MuseScore, do plugin e do protocolo quando disponiveis;
- SHA-256 do XML bruto exportado;
- SHA-256 do XML canonico, se o importador produzir uma versao normalizada;
- metadados declarados no arquivo para comparacao;
- `work.id` e `edition.id` escolhidos pelo editor;
- autor da confirmacao local, quando o fluxo dispuser dessa identidade.

O caminho local da partitura e o caminho temporario da ponte nao devem entrar
no dossie, em logs publicos ou no catalogo. Eles podem expor nome de usuario e
estrutura da maquina.

O MuseScore e a ponte sao **proveniencia tecnica da captura**, nao fonte
documental da melodia ou da harmonia. As fontes editoriais continuam sendo
registradas separadamente no dossie.

## Estados e transicoes

A integracao deve distinguir estes estados:

| Estado | Significado | Pode entrar no build publico? |
| --- | --- | --- |
| capturada | XML recebido e selado, ainda sem confirmacao editorial | nao |
| em revisao | vinculada a obra/edicao e validacoes em andamento | nao |
| valida | revisao editorial concluida | somente se direitos permitirem |
| bloqueada | uso publico impedido por direito, erro ou retirada | nao |
| substituida | versao historica sucedida por outra | nao como vigente |

Validacao tecnica do XML nao promove automaticamente a edicao para `valida`.
Permissao de direitos tambem nao corrige uma edicao invalida. Edicao, asset e
direitos permanecem estados independentes.

## Operacao atomica e recuperacao

Capturar, revisar e publicar serao operacoes distintas. A promocao deve ser
preparada em area privada, validar dossie, checksums, catalogo e pacote e so
entao substituir os artefatos publicos. Se qualquer etapa falhar:

- o catalogo publico anterior permanece valido;
- nenhum arquivo parcial fica acessivel em `public/`;
- a captura privada pode ser retomada ou descartada;
- a falha fica visivel ao editor sem expor caminhos ou tokens;
- uma repeticao com o mesmo `captureId` ou hash nao cria versao duplicada.

## Seguranca

Os seguintes invariantes sao obrigatorios:

- bind exclusivo em `127.0.0.1` ou equivalente de loopback aprovado;
- lista fechada de origens do importador local, sem origem do site publico;
- tokens aleatorios, efemeros e comparados de forma resistente a timing;
- endpoint inicial de pareamento incapaz de sequestrar silenciosamente uma
  sessao ativa;
- contrato validado em runtime, inclusive formato do payload;
- tamanho maximo configuravel e erro claro para partituras maiores;
- caminho real exatamente igual ao arquivo temporario autorizado;
- arquivo regular, sem links simbolicos aceitos;
- timeout, fila limitada e descarte controlado de respostas antigas;
- nenhum token, XML, caminho local ou parecer interno em logs publicos;
- ferramenta de escrita ausente ou inoperante no site publicado.

## Alternativas consideradas

### Usar diretamente o processo do Find Chord

Reduziria trabalho inicial, mas acoplaria disponibilidade, protocolo, portas e
evolucao de dois produtos com objetivos diferentes. Tambem levaria ao
Cancioneiro operacoes de mutacao e analise harmonica fora do seu escopo.

**Decisao:** nao adotada. Reutilizar desenho e testes, com implementacao
dedicada.

### Enviar o snapshot analitico do Find Chord

O snapshot atual reduz o MusicXML, considera apenas parte do documento para
algumas analises e produz uma identidade operacional. Isso perde informacao
necessaria para preservacao e revisao editorial.

**Decisao:** nao adotada como fonte da importacao. O XML bruto e o artefato de
captura; analises derivadas podem ser usadas apenas como relatorio auxiliar.

### Plugin escrever diretamente no repositorio

Eliminaria uma etapa, mas permitiria caminho incorreto, sobrescrita, estado
parcial e entrada de asset protegido em `public/` antes das validacoes.

**Decisao:** rejeitada.

### Manter somente o seletor manual de arquivo

E o fallback mais simples e continuara disponivel. Porem ele aumenta o numero
de passos manuais e nao informa de forma confiavel qual partitura do MuseScore
originou a captura.

**Decisao:** mantido como fallback, nao como unico fluxo.

### Extrair imediatamente uma biblioteca compartilhada

Poderia reduzir duplicacao entre Find Chord e Cancioneiro, mas exigiria
versionamento e governanca de um terceiro pacote antes de estabilizar o novo
contrato.

**Decisao:** adiada. Reavaliar depois de duas implementacoes compativeis e
testadas.

## Consequencias

- A Sprint 6 continua priorizando direitos e exclusao de assets bloqueados.
- A integracao completa ocorre na Sprint 6.1, depois do gate minimo de direitos.
- O seletor de arquivo continua funcionando durante toda a migracao.
- O primeiro protocolo do Cancioneiro sera apenas de captura, sem insercao de
  cifras ou outras mutacoes no MuseScore.
- Capturas privadas exigem uma area fora de `public/` e ignorada pelo Git.
- O importador atual precisara separar captura, vinculacao e promocao.
- Testes da ponte usarao porta efemera e um plugin simulado no CI.
- Copias substanciais de codigo MIT do Find Chord preservarao o aviso de
  licenca aplicavel.

## Criterios para revisar esta decisao

Reavaliar se:

- o MuseScore oferecer API autenticada que elimine o processo intermediario;
- outros editores passarem a exigir o mesmo protocolo;
- Find Chord e Cancioneiro estabilizarem contratos suficientemente iguais para
  justificar biblioteca compartilhada;
- o tamanho das partituras tornar o transporte atual inadequado;
- o fluxo passar a exigir mutacao bidirecional;
- a persistencia privada deixar de ser baseada em arquivos locais.

## Decisoes adiadas

- edicao bidirecional da partitura no MuseScore;
- suporte a outros editores de notacao;
- pacote compartilhado de ponte local;
- sincronizacao continua em vez de captura sob demanda;
- armazenamento multiusuario de capturas;
- analise musical automatica como criterio de aceitacao editorial.
