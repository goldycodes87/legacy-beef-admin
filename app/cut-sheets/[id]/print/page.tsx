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

function StyleText({ text, selected }: { text: string; selected: boolean }) {
  return <span style={{fontWeight: selected ? 'bold' : 'normal', textDecoration: selected ? 'underline' : 'none'}}>{text}</span>;
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

  return (
    <div style={{fontFamily:'Arial, sans-serif', maxWidth:850, margin:'0 auto', padding:16, fontSize:12, lineHeight:1.4}}>
      {/* Header with T-K logo and branding */}
      <div style={{textAlign:'center', marginBottom:12}}>
        <div style={{fontSize:24, fontWeight:'bold', letterSpacing:1.5, marginBottom:2}}>T-K PROCESSING</div>
        <div style={{fontSize:13, fontWeight:'bold'}}>Beef Cutting Instructions</div>
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
              <StyleText text="Roasts" selected={isSelected(a,'chuck','roasts')} /> &nbsp; 
              <StyleText text="Steaks" selected={isSelected(a,'chuck','steaks')} /> &nbsp; 
              <StyleText text="Grind" selected={isSelected(a,'chuck','grind')} />
              {(chuck?.thickness as any) && <span> — {String(chuck.thickness)}"</span>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Brisket</div>
            <div>
              <StyleText text="Yes (Whole)" selected={brisket.choice === 'yes_whole'} /> &nbsp; 
              <StyleText text="Yes (Half)" selected={brisket.choice === 'yes_half'} /> &nbsp; 
              <StyleText text="No" selected={brisket.choice === false || brisket.choice === 'no'} />
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Skirt Steak (if available)</div>
            <div>
              <StyleText text="Yes" selected={skirtIsTrue} /> &nbsp; 
              <StyleText text="No" selected={!skirtIsTrue} />
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Rib</div>
            <div>
              Roasts: <StyleText text="Bone-in" selected={isSelected(a,'rib','bone_in_roast')} /> &nbsp; 
              <StyleText text="Boneless" selected={isSelected(a,'rib','boneless_roast')} />
            </div>
            <div>
              Steaks: <StyleText text="Bone-in" selected={isSelected(a,'rib','bone_in_steaks')} /> &nbsp; 
              <StyleText text="Boneless" selected={isSelected(a,'rib','boneless_steaks')} />
              {(rib?.thickness as any) && <span> — {String(rib.thickness)}"</span>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Short Ribs</div>
            <div>
              <StyleText text="Yes" selected={short_ribsIsTrue} /> &nbsp; 
              <StyleText text="No" selected={!short_ribsIsTrue} />
            </div>
          </div>
        </div>

        {/* Hind Quarter */}
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline', textAlign:'center', marginBottom:10}}>HIND QUARTER</div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Sirloin</div>
            <div>
              <StyleText text="Roasts" selected={isSelected(a,'sirloin','roasts')} /> &nbsp; 
              <StyleText text="Steaks" selected={isSelected(a,'sirloin','steaks')} /> &nbsp; 
              <StyleText text="Grind" selected={isSelected(a,'sirloin','grind')} />
              {(sirloin?.thickness as any) && <span> — {String(sirloin.thickness)}"</span>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Round</div>
            <div>
              <StyleText text="Roasts" selected={isSelected(a,'round','roasts')} /> &nbsp; 
              <StyleText text="Steaks" selected={isSelected(a,'round','steaks')} /> &nbsp; 
              <StyleText text="Grind" selected={isSelected(a,'round','grind')} />
              {(round?.thickness as any) && <span> — {String(round.thickness)}"</span>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Short Loin</div>
            <div>
              <StyleText text="T-Bone Steaks" selected={isSelected(a,'short_loin','tbone')} />
              {(getAnswer(a,'short_loin')?.tbone_thickness as any) && <span> — {String(getAnswer(a,'short_loin').tbone_thickness)}"</span>}
            </div>
            <div>
              <StyleText text="NY Strip & Filet" selected={isSelected(a,'short_loin','ny_strip_and_filet')} />
              {(getAnswer(a,'short_loin')?.strip_thickness as any) && <span> — Strip: {String(getAnswer(a,'short_loin').strip_thickness)}" / Filet: {String(getAnswer(a,'short_loin').filet_thickness)}"</span>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Flank Steak</div>
            <div>
              <StyleText text="Yes" selected={flankIsTrue} /> &nbsp; 
              <StyleText text="No" selected={!flankIsTrue} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row — 4 columns */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16, borderBottom:'2px solid black', paddingBottom:12, marginBottom:12}}>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Stew Meat</div>
          <div>
            <StyleText text="Yes" selected={stew_meatIsTrue} /> &nbsp; 
            <StyleText text="No" selected={!stew_meatIsTrue} />
          </div>
          {(stew_meat?.pounds as any) && <div style={{fontSize:10, color:'#555'}}>{String(stew_meat.pounds)} lbs, {String(stew_meat.pkg_size)} packs</div>}
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Tenderized Round</div>
          <div>
            <StyleText text="Yes" selected={tenderized_roundIsTrue} /> &nbsp; 
            <StyleText text="No" selected={!tenderized_roundIsTrue} />
          </div>
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline', color:'darkred'}}>Organs</div>
          <div style={{fontSize:10, color:'darkred', marginBottom:4}}>Must be requested at drop-off or unavailable</div>
          <div><StyleText text="Tongue" selected={isSelected(a,'organs','tongue')} /></div>
          <div><StyleText text="Heart" selected={isSelected(a,'organs','heart')} /></div>
          <div><StyleText text="Liver" selected={isSelected(a,'organs','liver')} /></div>
          <div><StyleText text="Oxtail" selected={isSelected(a,'organs','oxtail')} /></div>
          <div><StyleText text="None" selected={isSelected(a,'organs','none')} /></div>
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Bones</div>
          <div><StyleText text="Dog" selected={isSelected(a,'bones','dog')} /></div>
          <div><StyleText text="Soup" selected={isSelected(a,'bones','soup')} /></div>
          <div><StyleText text="None" selected={isSelected(a,'bones','none')} /></div>
        </div>
      </div>

      {/* Packing information */}
      <div style={{marginBottom:12}}>
        <div style={{fontWeight:'bold', textDecoration:'underline', marginBottom:6}}>PACKING INFORMATION</div>
        <div>Percentage of Fat: <strong>{String(packing.fat_pct || '___')}</strong> &nbsp; | &nbsp; Pounds Per Pack of Burger: <strong>{String(packing.lbs_per_pack || '___')} lbs/pack</strong></div>
      </div>

      {/* T-K Processing Packing Sheet Footer */}
      <div style={{borderTop:'2px solid black', paddingTop:12, marginBottom:12}}>
        
        {/* Ambulatory at time of slaughter */}
        <div style={{marginBottom:10}}>
          <div style={{marginBottom:4}}>
            <strong>Ambulatory at Time of Slaughter:</strong> &nbsp; 
            <span style={{marginRight:20}}>Yes ___ Initials ___</span>
            <span>No ___ Initials ___</span>
          </div>
        </div>

        {/* Verification statement */}
        <div style={{marginBottom:10, fontSize:11, lineHeight:1.4}}>
          I verify the animals I brought in for slaughter have no residual antibiotics or veterinary medication and meet all specified requirements.
        </div>

        {/* Signature and date */}
        <div style={{marginBottom:10}}>
          <div>Customer Signature: _______________________ &nbsp;&nbsp; Date: __________</div>
        </div>

        {/* Specified Risk Material section */}
        <div style={{marginBottom:10, borderTop:'1px solid black', paddingTop:8}}>
          <div style={{fontWeight:'bold', marginBottom:4}}>Specified Risk Material:</div>
          <div style={{marginLeft:16}}>
            <div style={{marginBottom:4}}>Beef Age: &nbsp; 
              <input type="checkbox" style={{marginRight:4}} /> Less than 30 months &nbsp; 
              <input type="checkbox" style={{marginRight:4}} /> Older than 30 months
            </div>
          </div>
        </div>

        {/* Customer name for signature */}
        <div style={{marginBottom:10}}>
          <div>Customer Name (print): _______________________________</div>
        </div>

        {/* For Office Use Only */}
        <div style={{borderTop:'1px solid black', paddingTop:8, marginBottom:10}}>
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
        <div style={{marginTop:10, fontSize:10, lineHeight:1.3, color:'#333', borderTop:'1px solid black', paddingTop:6}}>
          <strong>PICKUP NOTICE:</strong> Your meat is typically ready for pickup 7-10 business days after drop-off. You will receive notification when ready. Please call 719-371-4700 to confirm pickup time.
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          button { display: none; }
        }
      `}</style>
    </div>
  );
}
