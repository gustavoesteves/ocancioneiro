import { PublicationPanel } from "../../components/PublicationPanel";

export default function PublicationPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#8a4c2f]">
        Ultima etapa
      </p>
      <h1 className="mt-2 text-4xl font-semibold">Publicacao</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#70695e]">
        Revise o lote completo antes de criar a versao, enviar o pull request e
        autorizar o deploy da biblioteca publica.
      </p>
      <div className="mt-7">
        <PublicationPanel defaultOpen />
      </div>
    </main>
  );
}
