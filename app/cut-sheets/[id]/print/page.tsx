'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface CutSheetAnswer {
  section: string;
  answers: Record<string, unknown>;
}

interface SessionData {
  id: string;
  purchase_type: string;
  customers: { name: string; phone: string; address: string; city: string; state: string } | null;
  animals: { name: string; butcher_date: string; animal_type: string } | null;
  cut_sheet_answers: CutSheetAnswer[];
}

function getAnswer(answers: CutSheetAnswer[], section: string): Record<string, unknown> {
  return answers.find(a => a.section === section)?.answers || {};
}

function isSelected(answers: CutSheetAnswer[], section: string, value: string): boolean {
  const a = getAnswer(answers, section);
  if (Array.isArray(a.choices)) return (a.choices as string[]).includes(value);
  return a.choice === value;
}

function SelectedOnly({ text }: { text: string }) {
  return <span style={{fontWeight:'bold', textDecoration:'underline'}}>{text}</span>;
}

export default function PrintCutSheetPage() {
  const params = useParams();
  const id = params.id as string;
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/cut-sheets')
      .then(r => r.json())
      .then(data => {
        const found = data.find((s: any) => s.id === id);
        setSession(found || null);
        setLoading(false);
        if (found) setTimeout(() => window.print(), 800);
      });
  }, [id]);

  if (loading) return <div style={{padding:40, fontFamily:'serif', textAlign:'center'}}>Loading Cut Sheet…</div>;
  if (!session) return <div style={{padding:40}}>Session not found.</div>;

  const a = session.cut_sheet_answers || [];
  
  // Get specific answers for display
  const rib = getAnswer(a, 'rib');
  const chuck = getAnswer(a, 'chuck');
  const brisket = getAnswer(a, 'brisket');
  const skirt = getAnswer(a, 'skirt');
  const short_ribs = getAnswer(a, 'short_ribs');
  const flank = getAnswer(a, 'flank');
  const stew_meat = getAnswer(a, 'stew_meat');
  const tenderized_round = getAnswer(a, 'tenderized_round');
  const sirloin = getAnswer(a, 'sirloin');
  const round = getAnswer(a, 'round');
  const organs = getAnswer(a, 'organs');
  const packing = getAnswer(a, 'packing');

  // Helper for boolean sections (Yes/No)
  const getYesNo = (section: any): 'yes' | 'no' => {
    if (section.choice === true || section.choice === 'yes') return 'yes';
    return 'no';
  };

  // Check if selected for different boolean patterns
  const skirtIsTrue = skirt.choice === true;
  const short_ribsIsTrue = short_ribs.choice === true;
  const flankIsTrue = flank.choice === true;
  const stew_meatIsTrue = stew_meat.choice !== false;
  const tenderized_roundIsTrue = tenderized_round.choice !== 'skipped' && tenderized_round.choice !== false;

  // Organ mapping
  const organNames: Record<string, string> = {
    tongue: 'Tongue',
    heart: 'Heart',
    liver: 'Liver',
    oxtail: 'Oxtail',
    none: 'None'
  };

  // Helper function to clean thickness values (strip trailing quotes)
  function cleanThickness(val: unknown): string {
    if (!val) return '';
    return String(val).replace(/"+$/, '"');
  }

  return (
    <div style={{fontFamily:'Arial, sans-serif', maxWidth:850, margin:'0 auto', padding:16, fontSize:12, lineHeight:1.4, WebkitPrintColorAdjust:'exact'}}>
      {/* Header with T-K logo and branding */}
      <div style={{textAlign:'center', marginBottom:12, borderBottom:'3px solid black', paddingBottom:8}}>
        <img 
          src="/tk-logo.png" 
          alt="T-K Processing"
          style={{height:60, width:'auto', display:'block', margin:'0 auto 4px'}}
        />
        <div style={{fontSize:13, fontWeight:'bold', marginTop:4}}>
          Beef Cutting Instructions
        </div>
        <div style={{fontSize:10, marginTop:4, maxWidth:700, margin:'4px auto 0', lineHeight:1.3}}>
          *Cut instructions must be received at time of drop off. If more than one option is selected, please note how much of each is desired. Questions? Call 719-371-4700 or email TbarkProcessing@Gmail.com
        </div>
      </div>

      {/* Customer Info - Reformatted */}
      <div style={{marginBottom:2, paddingBottom:2}}>
        Customer Name: <strong>{session.customers?.name || '_______________'}</strong> &nbsp; | &nbsp; Phone: <strong>{session.customers?.phone || '_______________'}</strong>
      </div>
      <div style={{borderBottom:'2px solid black', marginBottom:12, paddingBottom:4}}>
        Address: <strong>Legacy Land & Cattle — Grant Goldberg, 719-459-5151</strong>
      </div>

      {/* Two column layout - Front & Hind Quarters */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, borderBottom:'2px solid black', paddingBottom:12, marginBottom:12}}>

        {/* Front Quarter */}
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline', textAlign:'center', marginBottom:10}}>FRONT QUARTER</div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Chuck</div>
            <div>
              {isSelected(a,'chuck','roasts') && <div><SelectedOnly text="Roasts" />{chuck?.roast_weight ? ` — ${chuck.roast_weight} lb` : ''}</div>}
              {isSelected(a,'chuck','steaks') && <div><SelectedOnly text="Steaks" />{chuck?.thickness ? ` — ${cleanThickness(chuck.thickness)} thick` : ''}{chuck?.steaks_per_pack ? `, ${chuck.steaks_per_pack}/pack` : ''}</div>}
              {isSelected(a,'chuck','grind') && <div><SelectedOnly text="Grind" /></div>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Brisket</div>
            <div>
              {brisket.choice === 'yes_whole' && <SelectedOnly text="Yes (Whole)" />}
              {brisket.choice === 'half' && <SelectedOnly text="Yes (Half)" />}
              {(brisket.choice === false || brisket.choice === 'no') && <SelectedOnly text="No" />}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Skirt Steak (if available)</div>
            <div>
              {skirtIsTrue ? <SelectedOnly text="Yes" /> : <SelectedOnly text="No" />}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Rib</div>
            <div>
              {isSelected(a,'rib','bone_in_roast') && <div>Roasts: <SelectedOnly text="Bone-in" />{rib?.roast_weight ? ` — ${rib.roast_weight} lb` : ''}</div>}
              {isSelected(a,'rib','boneless_roast') && <div>Roasts: <SelectedOnly text="Boneless" />{rib?.roast_weight ? ` — ${rib.roast_weight} lb` : ''}</div>}
              {isSelected(a,'rib','bone_in_steaks') && <div>Steaks: <SelectedOnly text="Bone-in" />{rib?.thickness ? ` — ${cleanThickness(rib.thickness)} thick` : ''}{rib?.steaks_per_pack ? `, ${rib.steaks_per_pack}/pack` : ''}</div>}
              {isSelected(a,'rib','boneless_steaks') && <div>Steaks: <SelectedOnly text="Boneless" />{rib?.thickness ? ` — ${cleanThickness(rib.thickness)} thick` : ''}{rib?.steaks_per_pack ? `, ${rib.steaks_per_pack}/pack` : ''}</div>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Short Ribs</div>
            <div>
              {short_ribsIsTrue ? <SelectedOnly text="Yes" /> : <SelectedOnly text="No" />}
            </div>
          </div>
        </div>

        {/* Hind Quarter */}
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline', textAlign:'center', marginBottom:10}}>HIND QUARTER</div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Sirloin</div>
            <div>
              {isSelected(a,'sirloin','roasts') && <div><SelectedOnly text="Roasts" />{sirloin?.roast_weight ? ` — ${sirloin.roast_weight} lb` : ''}</div>}
              {isSelected(a,'sirloin','steaks') && <div><SelectedOnly text="Steaks" />{sirloin?.thickness ? ` — ${cleanThickness(sirloin.thickness)} thick` : ''}{sirloin?.steaks_per_pack ? `, ${sirloin.steaks_per_pack}/pack` : ''}</div>}
              {isSelected(a,'sirloin','grind') && <div><SelectedOnly text="Grind" /></div>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Round</div>
            <div>
              {isSelected(a,'round','roasts') && <div><SelectedOnly text="Roasts" />{round?.roast_weight ? ` — ${round.roast_weight} lb` : ''}</div>}
              {isSelected(a,'round','steaks') && <div><SelectedOnly text="Steaks" />{round?.thickness ? ` — ${cleanThickness(round.thickness)} thick` : ''}{round?.steaks_per_pack ? `, ${round.steaks_per_pack}/pack` : ''}</div>}
              {isSelected(a,'round','grind') && <div><SelectedOnly text="Grind" /></div>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Short Loin</div>
            <div>
              {isSelected(a,'short_loin','tbone') && <div><SelectedOnly text="T-Bone Steaks" />{getAnswer(a,'short_loin')?.tbone_thickness ? ` — ${cleanThickness(getAnswer(a,'short_loin').tbone_thickness)} thick` : ''}{getAnswer(a,'short_loin')?.steaks_per_pack ? `, ${getAnswer(a,'short_loin').steaks_per_pack}/pack` : ''}</div>}
              {isSelected(a,'short_loin','ny_strip_and_filet') && <div><SelectedOnly text="NY Strip & Filet" />{getAnswer(a,'short_loin')?.strip_thickness ? ` — Strip: ${cleanThickness(getAnswer(a,'short_loin').strip_thickness)}, Filet: ${cleanThickness(getAnswer(a,'short_loin').filet_thickness)}` : ''}</div>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Flank Steak</div>
            <div>
              {flankIsTrue ? <SelectedOnly text="Yes" /> : <SelectedOnly text="No" />}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row — 4 columns */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16, borderBottom:'2px solid black', paddingBottom:8, marginBottom:8}}>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Stew Meat</div>
          <div>
            {stew_meatIsTrue ? <SelectedOnly text="Yes" /> : <SelectedOnly text="No" />}
          </div>
          {(stew_meat?.pounds as any) && <div style={{fontSize:10, color:'#555'}}>{String(stew_meat.pounds)} lbs, {String(stew_meat.pkg_size)} packs</div>}
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Tenderized Round</div>
          <div>
            {tenderized_roundIsTrue ? <SelectedOnly text="Yes" /> : <SelectedOnly text="No" />}
          </div>
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline', color:'darkred'}}>Organs</div>
          <div style={{fontSize:10, color:'darkred', marginBottom:4}}>Must be requested at drop-off or unavailable</div>
          {['tongue','heart','liver','oxtail'].map(o => isSelected(a,'organs',o) && <div key={o}><SelectedOnly text={organNames[o]} /></div>)}
          {isSelected(a,'organs','none') && <div><SelectedOnly text="None" /></div>}
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Bones</div>
          {['dog','soup','none'].map(b => isSelected(a,'bones',b) && <div key={b}><SelectedOnly text={b.charAt(0).toUpperCase()+b.slice(1)} /></div>)}
        </div>
      </div>

      {/* Packing information */}
      <div style={{marginBottom:6}}>
        <div style={{fontWeight:'bold', textDecoration:'underline', marginBottom:6}}>PACKING INFORMATION</div>
        <div>
          Percentage of Fat: <strong>{String(packing.fat_pct || '___')}</strong>
          &nbsp;|&nbsp;
          Pounds Per Pack of Burger: <strong>
            {String(packing.lbs_per_pack || '___')} lbs/pack
          </strong>
        </div>
      </div>



      {/* PAGE 2 — Ambulatory + Specified Risk Material */}
      <div className="page-break" style={{paddingTop:40}}>
        {/* Ambulatory at time of slaughter */}
        <div style={{marginBottom:20, fontSize:13}}>
          <div style={{marginBottom:4}}>
            <strong>Ambulatory at Time of Slaughter:</strong> &nbsp; 
            <span style={{marginRight:20}}>Yes ___ Initials ___</span>
            <span>No ___ Initials ___</span>
          </div>
        </div>

        {/* Customer Signature section */}
        <div style={{marginBottom:20, fontSize:13}}>
          <div style={{marginBottom:20}}>
            <div>Customer Signature: _______________________ &nbsp;&nbsp; Date: __________</div>
          </div>
          <div style={{marginBottom:20, fontSize:12, lineHeight:1.4}}>
            I verify the animals I brought in for slaughter have no residual antibiotics or veterinary medication and meet all specified requirements.
          </div>
          <div style={{marginBottom:20}}>
            <div>Customer Name (print): _______________________________</div>
          </div>
        </div>

        {/* Specified Risk Material section */}
        <div style={{marginBottom:20, borderTop:'1px solid black', paddingTop:8, fontSize:13}}>
          <div style={{fontWeight:'bold', marginBottom:4}}>Specified Risk Material:</div>
          <div style={{marginLeft:16}}>
            <div style={{marginBottom:4}}>Beef Age: &nbsp; 
              <input type="checkbox" style={{marginRight:4}} /> Less than 30 months &nbsp; 
              <input type="checkbox" style={{marginRight:4}} /> Older than 30 months
            </div>
          </div>
        </div>

        {/* For Office Use Only */}
        <div style={{borderTop:'1px solid black', paddingTop:8, marginBottom:20, fontSize:13}}>
          <div style={{fontWeight:'bold', marginBottom:6}}>FOR OFFICE USE ONLY</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
            <div>
              <div>Removal Date: _________________</div>
              <div>Disposal Date: _________________</div>
            </div>
            <div>
              <div>Disposal Method: _________________</div>
              <div>Removal Method: _________________</div>
            </div>
          </div>
        </div>

        {/* Pickup notice */}
        <div style={{marginTop:20, fontSize:12, lineHeight:1.3, color:'#333', borderTop:'1px solid black', paddingTop:6}}>
          <strong>PICKUP NOTICE:</strong> Your meat is typically ready for pickup 7-10 business days after drop-off. You will receive notification when ready. Please call 719-371-4700 to confirm pickup time.
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          button { display: none; }
          @page { 
            margin: 0.5in;
            size: letter portrait;
          }
          html { -webkit-print-color-adjust: exact; }
          .page-break { page-break-before: always; break-before: page; }
        }
      `}</style>
    </div>
  );
}
