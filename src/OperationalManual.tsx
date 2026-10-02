import {useEffect,useRef,useState} from "react";
import {BookOpen,Download,Printer,Search,X} from "lucide-react";
import {roleLabel,type Role} from "./permissions";
import {manualSections,manualUpdated,manualSectionText,normalizeManualSearch,buildManualMarkdown,type ManualBlock,type ManualSection} from "./manual";

type Destination={id:string;name:string;active:boolean};
function Block({block}:{block:ManualBlock}) {
 if("text" in block)return block.kind==="note"?<aside className="manual-note">{block.text}</aside>:<p>{block.text}</p>;
 if("items" in block)return block.kind==="steps"?<ol>{block.items.map(item=><li key={item}>{item}</li>)}</ol>:<ul>{block.items.map(item=><li key={item}>{item}</li>)}</ul>;
 return <div className="manual-table-wrap"><table><thead><tr>{block.headers.map(header=><th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{block.rows.map(row=><tr key={row[0]}>{row.map((cell,i)=><td key={i}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
export function OperationalManual({open,onClose,role,destinations}:{open:boolean;onClose:()=>void;role:Role;destinations:Destination[]}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [query,setQuery]=useState("");
 const sections:ManualSection[]=manualSections.map(section=>section.id==="unidades"?{
  ...section,blocks:[...section.blocks,...(destinations.some(d=>d.active)?[{kind:"list" as const,items:destinations.filter(d=>d.active).map(d=>d.name)}]:[])]
 }:section);
 const term=normalizeManualSearch(query.trim());
 const visible=sections.filter(section=>!term||normalizeManualSearch(manualSectionText(section)).includes(term));
 const visibleIds=new Set(visible.map(section=>section.id));
 useEffect(()=>{
  const element=dialog.current;
  if(!element)return;
  if(open){
   setQuery("");
   if(!element.open)element.showModal();
   document.body.classList.add("manual-printing");
   element.querySelector<HTMLInputElement>("[data-manual-search]")?.focus();
  }else if(element.open)element.close();
  return()=>{document.body.classList.remove("manual-printing")};
 },[open]);
 function goTo(id:string){
  const heading=dialog.current?.querySelector<HTMLElement>("#manual-"+id);
  heading?.scrollIntoView({block:"start",behavior:"auto"});
  heading?.focus({preventScroll:true});
 }
 return <dialog ref={dialog} className="help-dialog" aria-labelledby="manual-title" aria-describedby="manual-intro"
  onCancel={event=>{event.preventDefault();onClose()}} onClose={onClose}>
  <header className="manual-header">
   <div><span className="eyebrow">LAUDOS AGUDOS · AJUDA</span><h1 id="manual-title"><BookOpen size={23} aria-hidden="true"/>Manual operacional</h1>
   <p id="manual-intro">Instruções por tarefa, permissões e solução de dúvidas.</p>
   <small>Atualizado em {manualUpdated} · Seu perfil: {roleLabel(role)}</small></div>
   <div className="manual-toolbar">
    <a className="manual-tool-button" download="Laudos-Agudos-Manual-Operacional.md" href={"data:text/markdown;charset=utf-8,"+encodeURIComponent(buildManualMarkdown(sections))}><Download size={16} aria-hidden="true"/>Baixar manual</a>
    <button type="button" className="manual-tool-button" onClick={()=>window.print()}><Printer size={16} aria-hidden="true"/>Imprimir / salvar PDF</button>
    <button type="button" className="manual-close icon-button" aria-label="Fechar manual" title="Fechar manual (Esc)" onClick={onClose}><X size={19} aria-hidden="true"/></button>
   </div>
  </header>
  <div className="manual-layout">
   <nav className="manual-index" aria-label="Sumário do manual">
    <label className="manual-search"><span><Search size={15} aria-hidden="true"/>Buscar no manual</span><input data-manual-search value={query} onChange={event=>setQuery(event.target.value)} placeholder="Ex.: autorização, cancelamento…" type="search"/></label>
    <p className="manual-results" role="status">{visible.length} {visible.length===1?"tópico encontrado":"tópicos encontrados"}</p>
    {visible.map(section=><button type="button" className="manual-topic" key={section.id} onClick={()=>goTo(section.id)}>{section.title}</button>)}
   </nav>
   <div className="manual-content">
    {visible.length===0&&<p className="manual-empty" role="status">Nenhum tópico encontrado. Tente outra palavra ou limpe a busca.</p>}
    {sections.map(section=><section className="manual-section" hidden={!visibleIds.has(section.id)} key={section.id} aria-labelledby={"manual-"+section.id}>
     <h2 id={"manual-"+section.id} tabIndex={-1}>{section.title}</h2><p className="manual-summary">{section.summary}</p>
     {section.blocks.map((block,i)=><Block key={i} block={block}/>)}
    </section>)}
   </div>
  </div>
 </dialog>;
}
