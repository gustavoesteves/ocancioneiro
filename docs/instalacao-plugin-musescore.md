# Instalacao do plugin de captura do MuseScore

**Plugin:** `plugins/CancioneiroCapture.qml`
**Aplicacao alvo desta etapa:** MuseScore Studio 4
**Estado:** implementado; fluxo feliz validado no MuseScore Studio 4.7.3

## O que o plugin faz

O plugin aguarda um pedido da ponte local e exporta a partitura ativa em
MusicXML para o unico arquivo temporario autorizado. Ele nao insere cifras,
nao altera notas, nao modifica layout e nao escreve no repositorio.

## Instalar

1. Encerre o MuseScore.
2. Localize a pasta de plugins configurada pelo MuseScore. No macOS, a pasta
   pessoal costuma ficar dentro de `Documents/MuseScore4/Plugins`; confirme o
   caminho nas preferencias de pastas da sua instalacao.
3. Copie `plugins/CancioneiroCapture.qml` para essa pasta.
4. Abra novamente o MuseScore.
5. Abra o gerenciador de plugins, localize **O Cancioneiro — Captura MusicXML**
   e habilite o plugin.
6. Inicie a ponte, em outro terminal, com `npm run bridge:musescore`.
7. Abra o plugin pelo menu **Plugins > O Cancioneiro > Capturar MusicXML**.

O estado esperado e `pareado`. `ponte ausente` significa que a ponte nao esta
rodando na porta local padrao. A porta desta primeira versao do plugin e
`47631`.

## Estados apresentados

| Estado | Significado |
| --- | --- |
| `ponte ausente` | processo local indisponivel ou sessao expirada |
| `pareado` | plugin autenticado e aguardando pedido |
| `exportando` | MusicXML sendo gravado no temporario autorizado |
| `enviado` | ponte recebeu e validou a exportacao |
| `falhou` | exportacao ou entrega falhou de forma explicita |

A tela tambem mostra a partitura ativa e o nome visivel na ultima tentativa.
Se nao houver partitura ativa, o importador recebe `NO_ACTIVE_SCORE` em vez de
esperar por timeout.

## Atualizar

1. Encerre o MuseScore.
2. Substitua somente `CancioneiroCapture.qml` pela nova versao.
3. Reabra o MuseScore e confira o numero da versao no gerenciador de plugins.
4. Reinicie a ponte para obter novas sessoes e tokens.

## Remover ou fazer rollback

1. Desabilite o plugin no gerenciador do MuseScore.
2. Encerre a ponte com `Ctrl+C`.
3. Remova `CancioneiroCapture.qml` da pasta pessoal de plugins, se desejar.

O seletor manual de MusicXML continua funcional. Remover plugin e ponte nao
altera dossies, catalogo ou capturas editoriais ja confirmadas.

## Checklist manual antes de considerar a S6.1-C aceita

- [x] plugin aparece e abre no MuseScore Studio 4 instalado;
- [ ] ponte ausente produz estado recuperavel;
- [x] iniciar a ponte muda o estado para `pareado`;
- [ ] partitura ativa e exibida corretamente;
- [x] pedido exporta um MusicXML completo e chega com SHA-256 valido;
- [ ] nenhuma partitura ativa produz `NO_ACTIVE_SCORE`;
- [ ] reiniciar a ponte renova sessao sem aceitar resposta antiga;
- [ ] trocar de partitura fica visivel antes da proxima captura;
- [ ] fechar plugin e ponte nao deixa processo ou temporario.

Evidencia do fluxo feliz registrada no
[ensaio real de 2026-08-13](evidencias/ensaio-captura-musescore-2026-08-13.md).
