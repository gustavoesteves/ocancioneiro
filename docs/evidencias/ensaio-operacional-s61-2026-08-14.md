# Evidencia — ensaio operacional da Sprint 6.1 em 2026-08-14

## Escopo

Ensaio automatizado do fluxo editorial local com uma composicao sintetica
criada exclusivamente como fixture. Nenhum repertorio real, arquivo privado ou
asset do catalogo do Cancioneiro foi usado.

## Comando

```bash
npm run workflow:musescore:check
```

Resultado observado:

```text
Fluxo local validado: captura=true, pacote=1, rollback=true.
```

## Invariantes confirmadas

- captura privada criada e verificada pelos hashes registrados;
- promocao aceita somente com curadoria, edicao e direitos elegiveis;
- pacote intermediario contem exatamente um MusicXML autorizado;
- rollback remove o novo asset da arvore publica;
- pacote regenerado depois do rollback contem zero MusicXML;
- captura privada permanece integra depois do rollback;
- dossie e catalogo anteriores sao restaurados;
- todo o projeto de ensaio e removido no bloco de limpeza final.

O teste automatizado correspondente e executado pela suite geral. Este ensaio
nao substitui a revisao da documentacao por outro editor nem os cenarios
visuais pendentes no MuseScore real.
