'use client';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface CutSheetAnswer {
  section: string;
  answers: Record<string, unknown>;
  half?: 'A' | 'B' | null;
  custom_request?: string | null;
  custom_request_status?: string | null;
}

const SECTION_LABELS: Record<string, string> = {
  chuck: 'Chuck', brisket: 'Brisket', skirt: 'Skirt Steak', rib: 'Rib',
  short_ribs: 'Short Ribs', sirloin: 'Sirloin', round: 'Round',
  short_loin: 'Short Loin', flank: 'Flank', stew_meat: 'Stew Meat',
  tenderized_round: 'Tenderized Round', organs: 'Organs', bones: 'Bones',
  packing: 'Ground Beef',
};

/**
 * Approved special requests for this half. These were collected from the
 * customer and approved in the admin, but never made it onto the sheet that
 * goes to T-K — so the butcher never saw any of them.
 */
function approvedRequests(answers: CutSheetAnswer[], half: 'A' | 'B' | null) {
  return answers.filter(
    (a) =>
      a.custom_request &&
      a.custom_request.trim() &&
      a.custom_request_status === 'approved' &&
      (half === null || (a.half ?? null) === half || (a.half ?? null) === null)
  );
}

interface SessionData {
  id: string;
  purchase_type: string;
  customers: { name: string; phone: string; address: string; city: string; state: string } | null;
  animals: { name: string; butcher_date: string; animal_type: string } | null;
  cut_sheet_answers: CutSheetAnswer[];
  dual_cut_sheet?: boolean;
}

function getAnswerForHalf(
  answers: CutSheetAnswer[],
  section: string,
  half: 'A' | 'B' | null
): Record<string, unknown> {
  if (half === null) {
    return answers.find(a => a.section === section && (a.half ?? null) === null)?.answers || {};
  }
  const halfSpecific = answers.find(
    a => a.section === section && (a.half ?? null) === half
  );
  if (halfSpecific) return halfSpecific.answers;
  const bothHalves = answers.find(
    a => a.section === section && (a.half ?? null) === null
  );
  return bothHalves?.answers || {};
}

function isSelectedForHalf(
  answers: CutSheetAnswer[],
  section: string,
  value: string,
  half: 'A' | 'B' | null
): boolean {
  const a = getAnswerForHalf(answers, section, half);
  if (Array.isArray(a.choices)) return (a.choices as string[]).includes(value);
  return a.choice === value;
}

function SelectedOnly({ text }: { text: string }) {
  return <span style={{fontWeight:'bold', textDecoration:'underline'}}>{text}</span>;
}

function CutSheetContent({ session, half }: { session: SessionData; half: 'A' | 'B' | null }) {
  const answers = session.cut_sheet_answers || [];

  // Get specific answers for display
  const rib = getAnswerForHalf(answers, 'rib', half);
  const chuck = getAnswerForHalf(answers, 'chuck', half);
  const brisket = getAnswerForHalf(answers, 'brisket', half);
  const skirt = getAnswerForHalf(answers, 'skirt', half);
  const short_ribs = getAnswerForHalf(answers, 'short_ribs', half);
  const flank = getAnswerForHalf(answers, 'flank', half);
  const stew_meat = getAnswerForHalf(answers, 'stew_meat', half);
  const tenderized_round = getAnswerForHalf(answers, 'tenderized_round', half);
  const sirloin = getAnswerForHalf(answers, 'sirloin', half);
  const round = getAnswerForHalf(answers, 'round', half);
  const packing = getAnswerForHalf(answers, 'packing', half);

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

  const halfLabel = half ? ` — Half ${half}` : '';
  const specialRequests = approvedRequests(answers, half);

  return (
    <div>
      {/* Header with T-K logo and branding */}
      <div style={{textAlign:'center', marginBottom:12, borderBottom:'3px solid black', paddingBottom:8}}>
        <img 
          src="/tk-logo.png" 
          alt="T-K Processing"
          style={{height:60, width:'auto', display:'block', margin:'0 auto 4px'}}
        />
        <div style={{fontSize:13, fontWeight:'bold', marginTop:4}}>
          Beef Cutting Instructions{halfLabel}
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
        Address: <strong>Legacy Land & Cattle — Grant Goldberg, 719-258-1777</strong>
      </div>

      {/* Two column layout - Front & Hind Quarters */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, borderBottom:'2px solid black', paddingBottom:12, marginBottom:12}}>

        {/* Front Quarter */}
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline', textAlign:'center', marginBottom:10}}>FRONT QUARTER</div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Chuck</div>
            <div>
              {isSelectedForHalf(answers,'chuck','roasts', half) && <div><SelectedOnly text="Roasts" />{chuck?.roast_weight ? ` — ${chuck.roast_weight} lb` : ''}</div>}
              {isSelectedForHalf(answers,'chuck','steaks', half) && <div><SelectedOnly text="Steaks" />{chuck?.thickness ? ` — ${cleanThickness(chuck.thickness)} thick` : ''}{chuck?.steaks_per_pack ? `, ${chuck.steaks_per_pack}/pack` : ''}</div>}
              {isSelectedForHalf(answers,'chuck','grind', half) && <div><SelectedOnly text="Grind" /></div>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Brisket</div>
            <div>
              {brisket.choice === 'yes_whole' && <SelectedOnly text="Yes (Whole)" />}
              {(brisket.choice === 'half' || brisket.choice === 'yes_half') && <SelectedOnly text="Yes (Half)" />}
              {(brisket.choice === false || brisket.choice === 'no') && <SelectedOnly text="No" />}
              {!brisket.choice && <span style={{color:'#999'}}>Not specified</span>}
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
              {isSelectedForHalf(answers,'rib','bone_in_roast', half) && <div>Roasts: <SelectedOnly text="Bone-in" />{rib?.roast_weight ? ` — ${rib.roast_weight} lb` : ''}</div>}
              {isSelectedForHalf(answers,'rib','boneless_roast', half) && <div>Roasts: <SelectedOnly text="Boneless" />{rib?.roast_weight ? ` — ${rib.roast_weight} lb` : ''}</div>}
              {isSelectedForHalf(answers,'rib','bone_in_steaks', half) && <div>Steaks: <SelectedOnly text="Bone-in" />{rib?.thickness ? ` — ${cleanThickness(rib.thickness)} thick` : ''}{rib?.steaks_per_pack ? `, ${rib.steaks_per_pack}/pack` : ''}</div>}
              {isSelectedForHalf(answers,'rib','boneless_steaks', half) && <div>Steaks: <SelectedOnly text="Boneless" />{rib?.thickness ? ` — ${cleanThickness(rib.thickness)} thick` : ''}{rib?.steaks_per_pack ? `, ${rib.steaks_per_pack}/pack` : ''}</div>}
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
              {isSelectedForHalf(answers,'sirloin','roasts', half) && <div><SelectedOnly text="Roasts" />{sirloin?.roast_weight ? ` — ${sirloin.roast_weight} lb` : ''}</div>}
              {isSelectedForHalf(answers,'sirloin','steaks', half) && <div><SelectedOnly text="Steaks" />{sirloin?.thickness ? ` — ${cleanThickness(sirloin.thickness)} thick` : ''}{sirloin?.steaks_per_pack ? `, ${sirloin.steaks_per_pack}/pack` : ''}</div>}
              {isSelectedForHalf(answers,'sirloin','grind', half) && <div><SelectedOnly text="Grind" /></div>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Round</div>
            <div>
              {isSelectedForHalf(answers,'round','roasts', half) && <div><SelectedOnly text="Roasts" />{round?.roast_weight ? ` — ${round.roast_weight} lb` : ''}</div>}
              {isSelectedForHalf(answers,'round','steaks', half) && <div><SelectedOnly text="Steaks" />{round?.thickness ? ` — ${cleanThickness(round.thickness)} thick` : ''}{round?.steaks_per_pack ? `, ${round.steaks_per_pack}/pack` : ''}</div>}
              {isSelectedForHalf(answers,'round','grind', half) && <div><SelectedOnly text="Grind" /></div>}
            </div>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Short Loin</div>
            <div>
              {isSelectedForHalf(answers,'short_loin','tbone', half) && <div><SelectedOnly text="T-Bone Steaks" />{getAnswerForHalf(answers,'short_loin', half)?.tbone_thickness ? ` — ${cleanThickness(getAnswerForHalf(answers,'short_loin', half).tbone_thickness)} thick` : ''}{getAnswerForHalf(answers,'short_loin', half)?.steaks_per_pack ? `, ${getAnswerForHalf(answers,'short_loin', half).steaks_per_pack}/pack` : ''}</div>}
              {isSelectedForHalf(answers,'short_loin','ny_strip_and_filet', half) && <div><SelectedOnly text="NY Strip & Filet" />{getAnswerForHalf(answers,'short_loin', half)?.strip_thickness ? ` — Strip: ${cleanThickness(getAnswerForHalf(answers,'short_loin', half).strip_thickness)}, Filet: ${cleanThickness(getAnswerForHalf(answers,'short_loin', half).filet_thickness)}` : ''}</div>}
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
          {['tongue','heart','liver','oxtail'].map(o => isSelectedForHalf(answers,'organs',o, half) && <div key={o}><SelectedOnly text={organNames[o]} /></div>)}
          {isSelectedForHalf(answers,'organs','none', half) && <div><SelectedOnly text="None" /></div>}
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Bones</div>
          {['dog','soup','none'].map(b => isSelectedForHalf(answers,'bones',b, half) && <div key={b}><SelectedOnly text={b.charAt(0).toUpperCase()+b.slice(1)} /></div>)}
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

      {/* Approved special requests — boxed so they are impossible to miss. */}
      {specialRequests.length > 0 && (
        <div style={{marginTop:10, border:'2px solid black', padding:8}}>
          <div style={{fontWeight:'bold', textDecoration:'underline', marginBottom:6}}>
            SPECIAL REQUESTS — PLEASE READ
          </div>
          {specialRequests.map((r, i) => (
            <div key={i} style={{marginBottom:6, fontSize:12, lineHeight:1.4}}>
              <strong>{SECTION_LABELS[r.section] || r.section}:</strong> {r.custom_request}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PrintCutSheetPage() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const halfParam = searchParams.get('half') as 'A' | 'B' | null;
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

  // A request left unreviewed prints as if it were never made. Flag it on
  // screen (never on the sheet) so it gets a decision before drop-off.
  const unreviewed = (session.cut_sheet_answers || []).filter(
    (a) => a.custom_request && a.custom_request.trim() && a.custom_request_status === 'pending'
  );

  const renderAmbulatoryPage = () => (
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
  );

  return (
    <div style={{fontFamily:'Arial, sans-serif', maxWidth:850, margin:'0 auto', padding:16, fontSize:12, lineHeight:1.4, WebkitPrintColorAdjust:'exact'}}>
      {unreviewed.length > 0 && (
        <div className="screen-only" style={{border:'2px solid #B45309', background:'#FFFBEB', color:'#7C2D12', borderRadius:8, padding:12, marginBottom:16}}>
          <strong>{unreviewed.length} special request{unreviewed.length === 1 ? '' : 's'} not yet approved or denied.</strong>
          <div style={{marginTop:6}}>
            Only approved requests print. Decide on these in Cut Sheets before drop-off:
          </div>
          <ul style={{margin:'6px 0 0 18px'}}>
            {unreviewed.map((a, i) => (
              <li key={i}>
                <strong>{SECTION_LABELS[a.section] || a.section}</strong>
                {a.half ? ` (Half ${a.half})` : ''}: {a.custom_request}
              </li>
            ))}
          </ul>
        </div>
      )}
      {session.dual_cut_sheet ? (
        <>
          {halfParam === 'B' ? null : <CutSheetContent session={session} half="A" />}
          {halfParam === null && <div className="page-break" />}
          {halfParam === 'A' ? null : <CutSheetContent session={session} half="B" />}
          <div className="page-break" />
          {renderAmbulatoryPage()}
        </>
      ) : (
        <>
          <CutSheetContent session={session} half={null} />
          {renderAmbulatoryPage()}
        </>
      )}
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
          .screen-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}
