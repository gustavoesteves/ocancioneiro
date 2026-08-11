# Especificação editorial v1

**Status:** proposta para aprovação no Sprint 0
**Escopo:** curadoria canônica, edição musical em formato lead sheet, fontes,
direitos e publicação
**Princípio arquitetural:** obra musical ≠ fonte consultada ≠ edição editorial
≠ arquivo distribuído

## 1. Objetivo

Esta especificação define o que O Cancioneiro publica, como uma obra entra no
acervo e quais informações precisam sustentar cada decisão editorial.

O Cancioneiro é um acervo editorial navegável do repertório comum da música
brasileira. Seu objetivo não é reunir sucessos por popularidade nem produzir
partituras completas. O projeto documenta repertório e publica edições de
referência em formato lead sheet quando a pesquisa, a edição e os direitos
permitem.

Uma obra pode pertencer ao cânone mesmo quando ainda não possui lead sheet ou
quando sua partitura não pode ser publicada. Curadoria, edição e direitos são
processos independentes.

## 2. Definição editorial

> O Cancioneiro publica edições editoriais em formato lead sheet destinadas a
> preservar a identidade executável da obra — melodia, harmonia e forma
> essenciais — distinguindo explicitamente composição, fontes históricas,
> decisões editoriais e realizações ou arranjos particulares.

### 2.1 O que o lead sheet preserva

- melodia principal;
- símbolos de acorde que representem a estrutura harmônica adotada;
- forma, repetições, casas, codas e mudanças métricas essenciais;
- elementos sem os quais a identidade executável da obra seria alterada;
- informações mínimas necessárias para estudo, acompanhamento e execução.

### 2.2 O que o lead sheet não pretende preservar

- voicings específicos;
- acompanhamento escrito;
- instrumentação de uma gravação;
- contracantos pertencentes apenas a um arranjo;
- linhas de baixo incidentais;
- convenções rítmicas de uma realização específica;
- introduções, interlúdios, solos ou finais criados por arranjadores;
- articulações, dinâmicas e ornamentos que caracterizem uma performance, não a
  composição.

Uma convenção consagrada de performance pode ser documentada, mas não integra
automaticamente a edição canônica.

### 2.3 Teste de essencialidade

Para cada elemento além de melodia, harmonia e forma básica, a revisão deve
responder:

1. O elemento pertence à composição ou apenas a uma realização?
2. Sua remoção altera a identidade executável da obra?
3. Há fonte que sustente sua inclusão?
4. A inclusão permanece compatível com o formato lead sheet?

Somente elementos que satisfaçam o teste e tenham justificativa documentada
podem ser tratados como essenciais.

## 3. Princípios obrigatórios

1. **Repertório, não popularidade.** Fama comercial, isoladamente, não
   determina entrada no acervo.
2. **Curadoria documentada.** Toda aceitação ou rejeição deve possuir
   justificativa, evidências e histórico de revisão.
3. **Preservar identidade, não performance.** O lead sheet não reproduz um
   arranjo particular.
4. **Proveniência explícita.** Informações musicais e editoriais devem apontar
   para as fontes que as sustentam.
5. **Inferência visível.** Decisões não explícitas nas fontes não podem ser
   apresentadas como fatos autorais.
6. **Direitos não alteram o juízo musicológico.** Restrições jurídicas afetam a
   publicação, não a conclusão canônica.
7. **Alcance não é hierarquia.** Uma obra nuclear em uma tradição regional não
   é editorialmente inferior a uma obra de circulação nacional.
8. **Sem pontuação automática.** Evidências informam a decisão; nenhum score
   numérico produz canonicidade automaticamente.
9. **Mudanças rastreáveis.** Edições e decisões publicadas não são alteradas
   silenciosamente.
10. **Negação segura.** Na ausência de verificação de direitos, a distribuição
    do arquivo permanece bloqueada.

## 4. Limites do domínio

### 4.1 Obra musical

Representa a composição, independentemente de edição, tonalidade publicada,
arquivo ou situação jurídica.

Campos conceituais mínimos:

- identificador estável;
- título preferencial e títulos alternativos;
- autoria e papéis autorais;
- data ou período, quando conhecido;
- observações de identidade e atribuição.

Tonalidade, MusicXML e caminho de download não pertencem à identidade da obra.

### 4.2 Curadoria canônica

Registra a investigação sobre a presença da obra no repertório. Pode existir
antes de qualquer edição musical.

Inclui:

- estado editorial;
- afirmações canônicas contextualizadas;
- linguagens, tradições e papéis;
- evidências e fontes;
- decisões, justificativas, revisores e datas.

### 4.3 Fonte

É um objeto identificável consultado durante pesquisa, edição ou verificação de
direitos: manuscrito, edição, gravação, acervo, currículo, songbook, catálogo,
entrevista ou estudo.

Uma fonte não recebe autoridade absoluta. Sua adequação é avaliada para um uso
específico, como melodia, forma, harmonia, circulação ou atribuição.

### 4.4 Edição musical

É a realização editorial do Cancioneiro em formato lead sheet. Não é arranjo.
Uma obra pode ter mais de uma edição quando fontes, tonalidades de referência ou
decisões editoriais justificarem versões distintas.

### 4.5 Arquivo

É uma representação técnica de uma edição: MusicXML, PDF ou outro formato
derivado. Possui versão, checksum, tipo de mídia e estado de validação próprios.

### 4.6 Direitos

Registra a avaliação de publicação da composição, das fontes utilizadas, da
edição ou transcrição e de cada arquivo distribuído. Direitos são avaliados por
ação, território e período quando necessário.

## 5. Identidade e relacionamentos

Identificadores devem ser estáveis, opacos ao caminho físico e nunca
reutilizados para outra entidade.

Relações principais:

```text
OBRA
├── CURADORIA CANÔNICA
│   ├── AFIRMAÇÕES CANÔNICAS
│   ├── EVIDÊNCIAS
│   └── DECISÕES EDITORIAIS
├── EDIÇÕES MUSICAIS
│   ├── USOS DE FONTES
│   ├── DECISÕES MUSICAIS
│   └── ARQUIVOS
└── DIREITOS
```

Uma fonte pode sustentar várias evidências e decisões. Uma evidência pode ser
sustentada por várias fontes. Essas relações são muitos-para-muitos e devem
guardar localização precisa, como página, faixa, compasso, item de acervo ou
URL persistente.

## 6. Curadoria canônica

### 6.1 Estado editorial

Valores iniciais controlados:

- `candidata`: incluída na fila de investigação;
- `em_pesquisa`: levantamento documental em andamento;
- `em_revisao`: dossiê submetido à bancada editorial;
- `aceita`: pertence ao cânone em pelo menos um contexto documentado;
- `rejeitada`: não atende ao recorte, com justificativa preservada;
- `inconclusiva`: as evidências atuais não permitem conclusão.

O estado atual é derivado da decisão editorial vigente. Decisões anteriores não
são apagadas.

Decisões finais (`aceita`, `rejeitada` ou `inconclusiva`) devem receber um
`recordHash` SHA-256 calculado sobre o registro da decisão sem o próprio campo
`recordHash`. Esse selo torna alterações silenciosas detectáveis pelo validador:
qualquer mudança em status, justificativa, responsável, revisão ou data exige
novo hash e deve ser tratada como nova decisão editorial, não como edição
retroativa invisível.

### 6.2 Afirmação canônica contextualizada

Canonicidade não é uma propriedade escalar única. A mesma obra pode ocupar
posições diferentes em contextos distintos.

Cada afirmação deve registrar:

- contexto: música brasileira, choro, frevo, roda de samba ou outro vocabulário
  controlado;
- centralidade;
- alcance;
- período considerado, quando relevante;
- decisão e justificativa;
- `evidenceIds`: evidências que a sustentam, contradizem ou contextualizam.

Afirmações ainda hipotéticas podem existir durante pesquisa, mas uma afirmação
ligada a uma decisão editorial deve possuir justificativa e ao menos uma
evidência relacionada por ID. O vínculo aponta para evidências do próprio
dossiê; referências quebradas invalidam o registro.

Centralidade inicial:

- `nuclear`: sua ausência seria difícil de justificar dentro do contexto;
- `consolidada`: pertence claramente ao repertório recorrente do contexto;
- `contextual`: é necessária para compreender linguagem, história ou prática
  específica, embora sua circulação possa ser menor.

Alcance inicial, sem ordem hierárquica:

- `nacional`;
- `regional`;
- `comunidade`.

Uma obra pode possuir mais de uma afirmação. Exemplo:

```yaml
afirmacoesCanonicas:
  - contexto: choro
    centralidade: nuclear
    alcance: comunidade
  - contexto: musica_brasileira
    centralidade: consolidada
    alcance: nacional
```

### 6.3 Linguagens, tradições e papéis

`linguagens` descrevem gramáticas musicais, como choro, baião, xote, frevo ou
partido-alto. `tradições` descrevem práticas e comunidades históricas, como
roda de choro, forró pé-de-serra ou samba carioca.

Esses valores devem vir de vocabulários controlados, versionados e capazes de
registrar sinônimos e relações. Tags livres não substituem a taxonomia.

Papéis editoriais iniciais:

- histórico;
- formador de linguagem;
- repertório de execução;
- pedagógico;
- instrumental;
- vocal;
- influência;
- representatividade.

## 7. Evidências e fontes

### 7.1 Critérios editoriais

Uma obra deve satisfazer fortemente pelo menos dois critérios para avançar à
revisão, sem que isso produza aceitação automática:

1. permanência;
2. circulação;
3. formação de linguagem;
4. influência;
5. regravação relevante;
6. valor instrumental ou pedagógico;
7. valor histórico;
8. representatividade de uma tradição.

### 7.2 Testemunho de repertório

Testemunho de repertório é a evidência de que a obra passou a ser executada,
ensinada ou transmitida para além de sua realização original. É uma família de
evidências, não uma pontuação adicional.

Subtipos iniciais:

- repertório de roda ou comunidade de prática;
- currículo ou material pedagógico;
- presença recorrente em songbooks especializados;
- gravações por gerações e formações diferentes;
- programas de concerto, festivais ou concursos;
- depoimento qualificado de músicos, pesquisadores ou instituições.

### 7.3 Registro de evidência

Cada evidência deve conter:

- tipo e subtipo;
- afirmação em linguagem verificável;
- critério editorial relacionado;
- direção: `sustenta`, `contradiz` ou `contextualiza`;
- força: `forte`, `moderada` ou `fraca`;
- justificativa específica da força atribuída;
- fontes e localizadores;
- responsável pela avaliação;
- data e observações.

Força não é atributo eterno da fonte. É uma avaliação contextual e precisa de
justificativa própria, separada da justificativa geral da evidência.

### 7.4 Registro de fonte

Campos mínimos:

- identificador;
- tipo;
- título ou descrição;
- autoria, instituição ou responsável;
- data;
- referência bibliográfica ou catalográfica;
- URL, ISBN, número de acervo ou identificador equivalente;
- data de consulta;
- observações de proveniência.

Quando permitido, deve-se guardar um identificador persistente ou snapshot que
permita reencontrar a informação. O sistema não deve copiar material protegido
apenas para facilitar a pesquisa.

## 8. Edição em formato lead sheet

### 8.1 Fontes adotadas por aspecto

Não existe obrigação de uma única fonte principal para toda a edição. A edição
deve indicar quais fontes prevalecem por aspecto:

```yaml
fontesAdotadas:
  melodia: [fonte-manuscrito]
  forma: [fonte-edicao-original]
  harmonia: [fonte-gravacao-estreia]
```

Cada uso registra finalidade, adequação, confiabilidade contextual e
justificativa. Divergências relevantes entre fontes devem permanecer visíveis.

### 8.2 Harmonia editorial

Harmonia editorial é a representação em símbolos de acorde da estrutura
harmônica observável nas fontes adotadas.

Não se deve declarar “cifra original” quando a obra não possui símbolos
harmônicos autorais verificáveis. A origem da leitura deve ser registrada como:

- `transcricao`: explicitamente escrita ou inequivocamente audível;
- `reducao`: textura complexa convertida em símbolo de acorde;
- `inferencia`: leitura necessária diante de informação ambígua ou incompleta.

Alternativas musicalmente plausíveis devem ser registradas quando relevantes.

### 8.3 Decisões editoriais localizadas

Tipos iniciais:

- `transcricao`: representação do conteúdo explícito na fonte;
- `normalizacao`: alteração notacional sem mudança musical intencional;
- `reducao`: transformação de textura em informação de lead sheet;
- `inferencia`: escolha quando a fonte não determina uma única leitura;
- `emenda_editorial`: correção deliberada de provável erro ou inconsistência.

Cada decisão registra:

- aspecto afetado;
- localização musical, como compasso, tempo, voz ou intervalo;
- leitura adotada;
- fontes;
- tipo;
- confiança: `alta`, `media` ou `baixa`;
- alternativas relevantes;
- justificativa;
- editor, revisor e data.

Confiança é localizada. Não se atribui um número ou uma única confiança a toda
a obra quando apenas alguns trechos são ambíguos.

### 8.4 Elementos essenciais

Exemplos possíveis:

- anacruse estrutural;
- repetição irregular;
- mudança métrica;
- pedal ou baixo estrutural;
- coda integrante da composição;
- convenção formal indispensável.

Cada inclusão deve apontar para o teste de essencialidade e para sua fonte.

### 8.5 Práticas de performance

Introduções, finais, levadas ou convenções consolidadas que não pertençam ao
núcleo composicional podem ser documentadas fora da partitura canônica. Esse
registro não autoriza sua incorporação ao MusicXML principal.

### 8.6 Tonalidade

- `tonalidadeDaFonte`: tonalidade observada na fonte adotada;
- `tonalidadeCodificada`: tonalidade-base do MusicXML editorial;
- transposição de apresentação: transformação derivada, não nova afirmação
  sobre a obra.

Quando a tonalidade codificada divergir da fonte principal, a razão deve ser
documentada.

## 9. Arquivos e validação

Cada arquivo deve registrar:

- identificador da edição e versão;
- formato e tipo de mídia;
- caminho ou URL;
- algoritmo e valor do checksum;
- data e ferramenta de geração;
- estado: `pendente`, `valido`, `inconsistente` ou `substituido`;
- resultado das validações aplicáveis.

Requisitos mínimos do MusicXML publicável:

- documento MusicXML válido e seguro;
- melodia principal renderizável;
- cifras representáveis em `<harmony>` quando aplicável;
- forma e repetições essenciais coerentes;
- metadados de título e autoria consistentes com a obra;
- nenhuma informação de arranjo incluída sem decisão editorial;
- vínculo com edição, fontes e direitos;
- checksum reproduzível.

## 10. Direitos e publicação

### 10.1 Objetos avaliados

- composição;
- fonte consultada;
- edição ou transcrição do Cancioneiro;
- arquivo distribuído.

### 10.2 Estado de avaliação

- `nao_verificado`;
- `em_analise`;
- `liberado`;
- `restrito`;
- `bloqueado`.

Todo estado diferente de `nao_verificado` deve registrar fundamento, responsável,
data e, quando aplicável, território e validade. Este registro é operacional e
não substitui aconselhamento jurídico.

### 10.3 Ações independentes

- exibir metadados;
- exibir a partitura;
- reproduzir playback;
- imprimir;
- baixar PDF;
- distribuir MusicXML.

Cada ação recebe `nao_avaliada`, `permitida`, `restrita` ou `bloqueada`.
Permissão para uma ação não implica permissão para as demais. `nao_avaliada` é
tratada como bloqueada em qualquer operação pública.

As decisões são independentes no domínio jurídico, mas a arquitetura pode
acoplar ações na prática. No site estático atual, renderização e playback
carregam o MusicXML no navegador; portanto, exibir ou tocar implica entregar o
arquivo ao cliente. Ocultar o botão de download não é controle de acesso. Se a
distribuição do MusicXML estiver bloqueada, a partitura e o playback também
ficam bloqueados nessa arquitetura, salvo se existir outro artefato derivado e
explicitamente autorizado para a ação.

Da mesma forma, uma página exibida no navegador pode ser impressa ou capturada
fora dos controles da aplicação. Remover a ação de impressão é uma restrição de
interface, não uma garantia técnica. Quando o fundamento jurídico exigir
prevenção efetiva de impressão ou cópia, a exibição pública também deve ser
bloqueada.

Um asset sem direitos liberados não pode ser commitado em repositório público,
mesmo quando estiver excluído do build do site. O piloto deve usar material
liberado, fixtures sintéticas ou armazenamento privado aprovado para qualquer
arquivo ainda não publicável.

### 10.4 Matriz de publicação

| Curadoria | Edição | Direitos | Resultado permitido |
| --- | --- | --- | --- |
| aceita | inexistente | metadados permitidos | registro canônico sem partitura |
| aceita | válida | apenas metadados permitidos | metadados; arquivo bloqueado |
| aceita | válida | liberados para a ação | publicação conforme permissões |
| em pesquisa | qualquer | qualquer | ambiente editorial, não catálogo canônico |
| rejeitada | qualquer | qualquer | histórico interno, não acervo público |

## 11. Ciclos de vida independentes

```text
CURADORIA: candidata → em_pesquisa → em_revisao → aceita/rejeitada/inconclusiva
EDIÇÃO: inexistente → em_transcricao → em_revisao → valida → substituida
DIREITOS: nao_verificado → em_analise → liberado/restrito/bloqueado
PUBLICAÇÃO: oculta → metadados → partitura → downloads habilitados por ação
```

Nenhum ciclo deve inferir automaticamente o estado dos demais.

## 12. Versionamento e auditoria

- Toda entidade persistida possui `schemaVersion`.
- Decisões editoriais e versões publicadas são imutáveis.
- Correções criam nova revisão e preservam a anterior.
- Registros guardam autor, data e motivo da mudança.
- O catálogo público é projeção gerada; não é fonte editorial primária.
- Exclusão física não substitui estado editorial ou histórico.
- Migrações devem ser determinísticas e testadas com fixtures.

## 13. Contrato conceitual de exemplo

O exemplo abaixo comunica relações; não define ainda o layout físico dos
arquivos:

```json
{
  "work": {
    "id": "obra-doce-de-coco",
    "preferredTitle": "Doce de Coco",
    "creators": [{ "name": "Jacob do Bandolim", "role": "composer" }]
  },
  "curation": {
    "status": "aceita",
    "canonicalClaims": [
      {
        "context": "choro",
        "centrality": "nuclear",
        "reach": "comunidade",
        "decisionId": "decisao-001",
        "evidenceIds": ["evidencia-001"],
        "justification": "Fontes e testemunhos estruturados sustentam a posicao no contexto."
      }
    ]
  },
  "edition": null,
  "rights": {
    "status": "nao_verificado",
    "actions": {
      "displayMetadata": "nao_avaliada",
      "displayScore": "bloqueado",
      "downloadMusicXml": "bloqueado"
    }
  }
}
```

O Sprint 1 deve substituir valores provisórios por enums e contratos validados.

## 14. Relação com o sistema atual

Hoje `data/editorial.json` contém `genre`, `level`, `source`, `notes` e `tags`,
enquanto `public/catalog.json` combina esses dados com metadados extraídos do
MusicXML. O contrato atual exige um caminho MusicXML para toda música pública.

A migração deve:

1. preservar a leitura do catálogo atual durante a transição;
2. separar obra, curadoria, fontes, edição e direitos;
3. permitir obra aceita sem MusicXML;
4. substituir `source` singular por relações estruturadas sem perda de dados;
5. gerar uma projeção pública compatível até a interface adotar o novo contrato;
6. impedir que a ferramenta local apague histórico editorial ao excluir um
   arquivo;
7. manter `public/catalog.json` como artefato gerado.

## 15. Indicadores de cobertura

Indicadores servem para revelar áreas pouco pesquisadas, nunca para impor cotas
ou excluir obras legítimas.

Dimensões iniciais:

- região e comunidade;
- linguagem e tradição;
- período;
- autoria e papéis autorais;
- instrumental ou vocal;
- estado de pesquisa, edição e direitos;
- densidade e diversidade das evidências.

Como obras podem pertencer a múltiplas categorias, toda métrica deve informar
se usa contagem múltipla, contagem fracionada ou categoria principal. Percentuais
sem método explícito não são publicáveis.

A matriz documental inicial usa contagem simples de evidências: cada evidência
conta uma vez no critério declarado, agrupada por direção (`sustenta`,
`contradiz`, `contextualiza`). A contagem de obras indica quantas obras possuem
ao menos uma evidência naquele critério. Linhas zeradas permanecem visíveis para
mostrar lacunas. A matriz não calcula percentuais nem score.

## 16. Governança editorial

Papéis mínimos, acumuláveis por uma mesma pessoa mas registrados separadamente:

- pesquisador;
- editor musical;
- revisor musical;
- membro da bancada editorial;
- responsável por direitos;
- mantenedor técnico.

Uma decisão de aceitação precisa de revisor diferente do autor do dossiê quando
a equipe permitir. Divergências são registradas, não apagadas. Conflitos de
interesse devem ser declarados.

O registro da decisão usa `reviews[]` para preservar revisão e conflito de
interesse. Cada revisão informa `reviewedBy`, `reviewedAt`, `role`, `summary` e
`conflictOfInterest`. Quando `conflictOfInterest` for verdadeiro,
`conflictDescription` é obrigatório. Decisões com status `aceita` precisam de
pelo menos uma revisão registrada.

## 17. Critérios de aprovação desta especificação

A versão 1 pode ser aprovada quando:

- todos os termos controlados possuem definição não ambígua;
- obra, curadoria, edição, arquivo e direitos têm limites claros;
- os ciclos de vida não dependem uns dos outros;
- pelo menos cinco casos de teste editorial atravessam o modelo sem perda;
- a política de lead sheet resolve inclusão e exclusão de elementos;
- a política de direitos adota bloqueio seguro por padrão;
- as decisões abertas abaixo possuem responsável e prazo de revisão.

## 18. Decisões abertas para o Sprint 0

- nome final dos níveis de centralidade;
- vocabulário inicial de linguagens, tradições e papéis;
- política pública para metadados de obras com direitos não verificados;
- número mínimo de revisores por decisão;
- granularidade obrigatória dos localizadores musicais;
- política para letras, títulos alternativos e autoria contestada;
- critérios para criar mais de uma edição da mesma obra;
- política de retenção de fontes e snapshots;
- representação de territórios e prazos em direitos.
