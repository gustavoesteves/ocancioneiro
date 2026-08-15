# O Cancioneiro

O Cancioneiro e um acervo navegavel de partituras em MusicXML. A ideia e manter
as obras como arquivos-fonte versionados, exibir as partituras no browser e
oferecer busca, filtros, download, impressao/PDF e playback simples.

## Duas Superficies, Uma So Publica

O repositorio contem duas partes com destinos diferentes:

- **biblioteca publica:** e o produto hospedado no GitHub Pages. O comando
  `npm run build:pages` gera somente catalogo, busca, visualizacao, playback,
  impressao e downloads autorizados;
- **ferramenta local:** concentra o fluxo editorial de importacao. Ela roda com
  `npm run dev`, a partir de `http://localhost:3000/import`, e separa painel,
  captura, acervo, revisao e publicacao em rotas proprias. Pode usar
  `/api/import`, a ponte com MuseScore e operacoes de escrita locais.

O pacote publico nao inclui a rota `/import`, a API, a interface do importador
nem codigo de escrita editorial. `npm run build` valida a aplicacao completa,
mas nao gera o artefato oficial de publicacao. A decisao e os limites
verificaveis estao na
[`ADR 0003`](docs/adr/0003-superficies-publica-e-local.md).

## O Que Existe Hoje

- Catalogo carregado de `public/catalog.json`.
- Partituras em `public/musicxml/`.
- Renderizacao online com OpenSheetMusicDisplay.
- Busca por titulo, compositor, genero, tom, instrumentacao e tags.
- Extracao de cifras/acordes a partir de `<harmony>` no MusicXML.
- Filtros por nivel e genero.
- Download do MusicXML original.
- Impressao pelo navegador, incluindo salvar como PDF.
- Playback simples no navegador a partir do MusicXML.

## Linha Editorial

O Cancioneiro segue a logica de um songbook/lead sheet, inspirado no uso
pratico de livros como o Real Book, mas voltado ao repertorio brasileiro.

Principio interno:

> O Cancioneiro nao documenta hits. Documenta repertorio.

Fama nao basta. Uma musica pode ter vendido milhoes e ainda assim nao ser
canonica musicalmente para a proposta do Cancioneiro. O contrario tambem
acontece: `Doce de Coco`, de Jacob do Bandolim, provavelmente e menos conhecida
do publico geral do que muitos sucessos radiofonicos brasileiros, mas para quem
toca Choro ela funciona quase como vocabulario basico.

Por isso, a entrada de uma obra deve ser avaliada por criterios musicais,
historicos e praticos, nao por popularidade isolada:

| Criterio | Pergunta |
| --- | --- |
| Permanencia | Continua sendo tocada depois de sua epoca? |
| Circulacao | Musicos de diferentes geracoes conhecem ou tocam? |
| Linguagem | Tornou-se referencia de uma linguagem brasileira? |
| Influencia | Gerou descendencia musical? |
| Regravacao | Foi reinterpretada de maneira relevante muitas vezes? |
| Valor instrumental | Funciona como repertorio de execucao, estudo ou improvisacao? |
| Valor historico | E impossivel contar a historia da musica brasileira sem ela? |
| Representatividade | E uma referencia fundamental de determinada tradicao brasileira? |

A politica detalhada esta em
[`docs/especificacao-editorial-v1.md`](docs/especificacao-editorial-v1.md). O
plano de implementacao e validacao pelo piloto de Choro esta em
[`docs/sprints/piloto-choro.md`](docs/sprints/piloto-choro.md).

A captura direta da partitura ativa no MuseScore usa uma ponte local segura,
sem publicacao automatica. A decisao arquitetural esta na
[`ADR 0002`](docs/adr/0002-captura-musescore-ponte-local.md) e o backlog
executavel esta na
[`Sprint 6.1`](docs/sprints/sprint-06-1-captura-musescore.md). A integracao so
comeca depois que a Sprint 6 demonstrar que assets privados ou bloqueados ficam
fora do pacote publico.

O formato padrao de uma obra deve ser:

- melodia principal em uma pauta;
- cifras/acordes acima da melodia;
- forma e marcacoes essenciais quando ajudarem a tocar a musica;
- MusicXML limpo, legivel e facil de revisar.

Ha uma excecao editorial estreita: obras originalmente concebidas para piano
ou violao podem preservar a partitura instrumental original quando essa escrita
integra a identidade da composicao. A excecao precisa declarar o instrumento e
uma justificativa editorial; ela nao autoriza arranjos, transcricoes posteriores
ou partituras completas de cancoes.

O objetivo nao e publicar partituras completas, arranjos fechados ou reducoes
orquestrais. Isso deixaria o acervo mais lento de produzir e menos flexivel para
quem quer estudar, acompanhar, improvisar ou montar seu proprio arranjo.

Elementos alem de melodia, harmonia e forma basica so entram quando pertencem a
identidade executavel da composicao, possuem fonte e passam por decisao
editorial documentada. Convencoes de performance e elementos de arranjos podem
ser registrados fora da partitura, mas nao integram automaticamente o lead
sheet canonico.

## Como Rodar

Requisitos:

- Node.js `>=22.13.0`

Instale as dependencias:

```bash
npm install
```

Rode o app localmente:

```bash
npm run dev
```

Esse comando usa o runtime Node para a ferramenta editorial local. O build
continua validando o runtime Cloudflare, mas a API de escrita nao opera dentro
do filesystem virtual do Worker e nunca faz parte do artefato do GitHub Pages.

Depois abra:

```text
http://localhost:3000/
```

A ponte local de captura do MuseScore roda em um processo separado:

```bash
npm run bridge:musescore
```

O plugin de captura esta implementado em `plugins/CancioneiroCapture.qml` e o
fluxo feliz foi ensaiado no MuseScore Studio 4.7.3. A ponte e o plugin nao sao usados
nem incluidos no GitHub Pages. Consulte a
[`operacao da ponte`](docs/operacao-ponte-musescore.md) para limites e estado
atual e a
[`instalacao do plugin`](docs/instalacao-plugin-musescore.md) para o checklist.
O procedimento completo para outro editor esta no
[`manual operacional da importacao local`](docs/manual-operacional-importacao.md).

Para checar se a versao compila:

```bash
npm run build
```

Para executar a verificacao completa usada no deploy:

```bash
npm run check
```

Para gerar a versao estatica usada pelo GitHub Pages:

```bash
npm run build:pages
```

## Como Adicionar Uma Obra

Se estiver rodando localmente, abra `/import` para acompanhar a estacao
editorial. Use `/import/capturar` para receber uma nova peca pelo MuseScore ou
arquivo, `/import/acervo` para consultar centenas de obras sem sobrecarregar a
captura, `/import/revisao` para a fila privada e `/import/publicacao` para o
fluxo Git/GitHub. A captura mostra a previa, extrai metadados e permite escolher
um dossie editorial.

Obras com edicoes existentes podem ter genero, nivel, fonte, notas e tags
corrigidos pela pagina **Editar metadados** do dossie. Essa operacao altera a
edicao em `data/dossiers/` e regenera o catalogo, sem reimportar ou reescrever o
MusicXML. Uma mudanca musical na partitura continua exigindo o fluxo de captura,
revisao e promocao.

Confirmar uma captura grava somente na area privada `.local/cancioneiro/`,
ignorada pelo Git, e pode criar uma edicao `em_revisao` no dossie. Essa operacao
nao escreve em `public/`, nao valida a edicao e nao altera direitos. Consulte a
[`operacao das capturas privadas`](docs/operacao-capturas-privadas.md). Edicoes
legadas ja publicadas ainda podem ser mantidas localmente. No GitHub Pages,
`/import` nunca deve ser considerada uma ferramenta publica de escrita.

Depois da revisao, a promocao cria uma versao publica imutavel, atualiza dossie
e catalogo de forma recuperavel e preserva a versao anterior. Consulte a
[`operacao de promocao`](docs/operacao-promocao-musicxml.md).

Na rota **Publicacao**, o painel **Revisao e publicacao** permite verificar as mudancas,
preparar uma branch e um commit, abrir o pull request e, depois que os checks
remotos forem aprovados, iniciar a publicacao. Git e GitHub continuam sendo o
mecanismo interno, mas o operador nao precisa alternar para o terminal. A
ferramenta nunca faz essas transicoes automaticamente: preparar, enviar e
publicar exigem acoes e confirmacoes separadas.

1. Exporte ou salve a partitura em MusicXML.
2. Confira se ela segue a linha editorial do acervo:
   - melodia principal;
   - cifras/acordes em `<harmony>`;
   - titulo e compositor preenchidos quando possivel;
   - sem arranjo completo quando a melodia+cifra for suficiente.
3. Crie ou escolha o dossie da obra e registre fontes, edicao e direitos.
4. Mantenha o arquivo fora de `public/` enquanto estiver em revisao.
5. Depois de revisao e liberacao explicitas, promova o asset pelo fluxo
   controlado.
6. Abra **Revisao e publicacao**, verifique o lote, prepare a versao e envie o
   pull request.

O comando abaixo permanece como alternativa operacional e para automacao:

```bash
npm run catalog:generate
```

O script varre `public/musicxml/` para validar os arquivos, mas a saida publica
e projetada dos dossies. Arquivo sem dossie aceito, edicao valida e direitos
compativeis nao entra no `public/catalog.json` nem no pacote de deploy.

Ao final, o comando mostra pendencias editoriais dos registros ainda em
migracao. `data/editorial.json` permanece apenas como compatibilidade legada;
novas obras devem usar `data/dossiers/`.

Para validar que o catalogo versionado esta sincronizado sem modifica-lo:

```bash
npm run catalog:check
```

O catalogo publico usa `schemaVersion: 2`. Cada registro informa
`availability.status` e permissoes efetivas por acao. `musicxml` e opcional e
so aparece quando o arquivo pode ser entregue ao navegador. Obras aceitas com
metadados permitidos podem, portanto, continuar no catalogo sem partitura.

O build nao copia a pasta `public/` integralmente. Ele prepara somente os
MusicXML autorizados pelo catalogo e depois inspeciona o pacote. A arvore fonte
pode preservar assets historicos substituidos; o comando abaixo confere a
integridade dos caminhos vigentes, enquanto o verificador do pacote final
rejeita qualquer arquivo historico, bloqueado ou sem autorizacao que tente
chegar ao deploy:

```bash
npm run public-assets:check
```

O procedimento de urgencia esta em
[`docs/operacao-retirada-emergencial.md`](docs/operacao-retirada-emergencial.md).

## Dossies Editoriais

Os dossies estruturados vivem em `data/dossiers/`. Eles registram identidade da
obra, decisoes de curadoria, fontes, evidencias, edicoes, assets e direitos. O
JSON e a fonte editorial versionada; relatorios derivados devem ser gerados pelo
script para evitar divergencia.

Para validar os dossies:

```bash
npm run dossiers:check
```

Para gerar uma versao em Markdown, legivel no GitHub e adequada para revisao
humana:

```bash
npm run dossiers:review
```

Esse comando grava arquivos em `outputs/dossiers-review/`, pasta ignorada pelo
Git. Cada relatorio inclui pendencias, afirmacoes canonicas, decisoes, fontes,
evidencias com localizadores, edicoes, assets e permissao por acao. Use essa
saida para revisar o conteudo editorial sem abrir o codigo da aplicacao; quando
a revisao gerar mudancas, edite o JSON correspondente em `data/dossiers/` e
rode novamente `npm run dossiers:check`.

Decisoes editoriais podem ser seladas com `recordHash`, um SHA-256 calculado a
partir do proprio registro da decisao. Quando o campo existe, o validador acusa
qualquer alteracao silenciosa no conteudo da decisao. Mudancas de entendimento
devem entrar como nova decisao, preservando o historico.

## O Que O Script Detecta

O script tenta extrair automaticamente:

- `title`: de `<work-title>` ou `<movement-title>`.
- `composer`: de `<creator type="composer">`.
- `key`: de `<fifths>` e `<mode>`.
- `instrumentation`: de `<part-name>`.
- `chords`: de elementos `<harmony>`.
- `musicxml`: caminho publico do arquivo.
- `id`: baseado no caminho relativo do arquivo.

Campos editoriais ficam em `data/editorial.json`:

- `genre`
- `level`
- `source`
- `notes`
- `tags`

O `public/catalog.json` e um artefato gerado. Evite edita-lo manualmente. Para
alterar genero, nivel, fonte, notas ou tags, edite `data/editorial.json` e rode
`npm run catalog:generate`.

O manifesto editorial tambem e validado. Campos desconhecidos, tags vazias ou
valores obrigatorios vazios fazem o comando falhar. Entradas editoriais sem
MusicXML correspondente geram aviso no terminal, o que ajuda a encontrar ids
antigos depois de renomear ou remover arquivos.

Quando uma musica ja existe no catalogo, o script atualiza os campos derivados
do MusicXML e aplica os campos editoriais do manifesto. Durante migracoes, se um
id ainda nao existir no manifesto, o gerador consegue reaproveitar metadados
editoriais do catalogo existente. Uma assinatura SHA-256 interna (`sourceHash`)
mantem a identidade quando um arquivo sem alteracoes e movido ou renomeado.
IDs, caminhos e tipos tambem sao validados antes de o catalogo ser substituido
atomicamente.

## Exemplo De Entrada Editorial

```json
{
  "songs": {
    "estudo-de-abertura": {
      "genre": "Estudo",
      "level": "Inicial",
      "source": "Exemplo original",
      "notes": "Pequena peca de exemplo para validar o fluxo MusicXML.",
      "tags": ["musicxml", "exemplo", "melodia"]
    }
  }
}
```

## Exemplo De Entrada No Catalogo

```json
{
  "id": "estudo-de-abertura",
  "title": "Estudo de abertura",
  "composer": "O Cancioneiro",
  "genre": "Estudo",
  "key": "C maior",
  "level": "Inicial",
  "instrumentation": "Melodia",
  "source": "Exemplo original",
  "musicxml": "/musicxml/estudo-de-abertura.musicxml",
  "notes": "Pequena peca de exemplo para validar o fluxo MusicXML.",
  "chords": ["C", "G7"],
  "tags": ["musicxml", "exemplo", "melodia"],
  "availability": {
    "status": "disponivel",
    "reason": "Partitura disponivel conforme as permissoes editoriais vigentes.",
    "actions": {
      "exibir_partitura": true,
      "reproduzir_playback": true,
      "imprimir": true,
      "baixar_pdf": false,
      "distribuir_musicxml": true
    }
  }
}
```

## Fluxo Recomendado

Para uma nova peca durante a Sprint 6:

1. crie o dossie em `data/dossiers/`;
2. registre curadoria, fontes, edicao e direitos sem inferir permissao;
3. revise o MusicXML fora da arvore publica;
4. torne a edicao `valida` somente apos revisao musical;
5. promova para `public/musicxml/` somente quando todas as acoes entregues pelo
   site estiverem explicitamente permitidas;
6. rode `npm run catalog:generate` e `npm run check`;
7. abra o app e confira tanto a obra disponivel quanto uma fixture sem
   partitura.

O `public/catalog.json` deve mudar como resultado do gerador. Ele continua sendo
artefato gerado; revise o diff, mas altere a fonte editorial no dossie.

## Estrutura Principal

```text
app/
  components/
    CancioneiroApp.tsx
    ScoreViewer.tsx
data/
  editorial.json
public/
  catalog.json
  musicxml/
scripts/
  generate-catalog.mjs
```

## Publicacao No GitHub Pages

O projeto inclui o workflow `.github/workflows/pages.yml`.

Quando houver push no branch `main`, o GitHub Actions:

1. instala as dependencias;
2. roda `npm run check`;
3. publica a pasta `github-pages` no GitHub Pages.

Em pull requests, o mesmo workflow roda a validacao, mas nao publica.

Na ferramenta local, o painel **Revisao e publicacao** representa esse mesmo
fluxo em quatro passos: verificar, preparar versao, enviar para revisao e
publicar. O ultimo passo apenas faz o merge de um pull request aprovado; o
deploy continua sendo responsabilidade exclusiva do workflow do GitHub Pages.

No GitHub, configure Pages para usar **GitHub Actions** como fonte de deploy.

## Observacoes Sobre Playback

O playback atual e propositalmente simples. A rotina compartilhada em
`lib/playback.mjs` le notas, pausas, duracoes, acordes escritos na pauta,
mudancas de andamento, `backup` e `forward` do MusicXML. A interface usa esses
eventos para gerar som com Web Audio no browser.

Isso ja serve para conferir a melodia, acordes basicos e entradas com multiplas
vozes simples. Ainda nao e uma interpretacao musical completa: nao aplica
articulacoes, dinamicas, swing, pedais, instrumentos reais, repeticoes
complexas, ornamentos ou acompanhamento a partir das cifras (`<harmony>`).

Os casos principais do parser ficam cobertos por `tests/playback.test.mjs`.
Quando o acervo real revelar novos limites, adicione primeiro um teste pequeno
com o trecho MusicXML minimo e depois ajuste `lib/playback.mjs`.

Uma versao mais musical pode vir depois com uma pipeline MusicXML para MIDI,
SoundFont, cursor seguindo a partitura, controle de andamento e metronomo.
