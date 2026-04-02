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

function SelectedMark({ selected }: { selected: boolean }) {
  return selected ? <span style={{fontWeight:'bold', textDecoration:'underline'}}> ← SELECTED</span> : null;
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
  const rib = getAnswer(a, 'rib');
  const packing = getAnswer(a, 'packing');

  return (
    <div style={{fontFamily:'Arial, sans-serif', maxWidth:800, margin:'0 auto', padding:20, fontSize:13}}>
      {/* Header */}
      <div style={{textAlign:'center', marginBottom:16}}>
        <div style={{fontSize:22, fontWeight:'bold', letterSpacing:2, marginBottom:4}}>T-K PROCESSING</div>
        <div style={{fontSize:15, fontWeight:'bold'}}>Beef Cutting Instructions</div>
        <div style={{fontSize:11, marginTop:6, maxWidth:600, margin:'6px auto 0'}}>
          *Cut instructions must be received at time of drop off. If more than one option is selected, please note how much of each is desired. Questions? Call 719-371-4700 or email TbarkProcessing@Gmail.com
        </div>
      </div>

      {/* Customer Info */}
      <div style={{borderBottom:'1px solid black', marginBottom:8, paddingBottom:4}}>
        <strong>Customer Name:</strong> {session.customers?.name || '_______________'}
        &nbsp;&nbsp;&nbsp;&nbsp;
        <strong>Phone:</strong> {session.customers?.phone || '_______________'}
      </div>
      <div style={{borderBottom:'1px solid black', marginBottom:16, paddingBottom:4}}>
        <strong>Address:</strong> {session.customers?.address ? `${session.customers.address}, ${session.customers.city}, ${session.customers.state}` : '_______________'}
      </div>

      {/* Two column layout */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, borderBottom:'2px solid black', paddingBottom:16, marginBottom:16}}>

        {/* Front Quarter */}
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline', textAlign:'center', marginBottom:12}}>Front Quarter</div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Chuck</div>
            <div>Roasts<SelectedMark selected={isSelected(a,'chuck','roasts')}/></div>
            <div>Steaks<SelectedMark selected={isSelected(a,'chuck','steaks')}/></div>
            <div>Grind<SelectedMark selected={isSelected(a,'chuck','grind')}/></div>
            {!!getAnswer(a,'chuck').thickness && <div style={{fontSize:11, color:'#555'}}>Thickness: {String(getAnswer(a,'chuck').thickness)}</div>}
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Brisket</div>
            <div>Yes (Whole)<SelectedMark selected={isSelected(a,'brisket','yes_whole')}/></div>
            <div>Yes (Half)<SelectedMark selected={isSelected(a,'brisket','yes_half')}/></div>
            <div>No<SelectedMark selected={isSelected(a,'brisket','no')}/></div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Skirt Steak (if available)</div>
            <div>Yes<SelectedMark selected={isSelected(a,'skirt','yes')}/> &nbsp; No<SelectedMark selected={isSelected(a,'skirt','no')}/></div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Rib</div>
            <div>Roasts: Bone-in<SelectedMark selected={isSelected(a,'rib','bone_in_roast')}/> &nbsp; Boneless<SelectedMark selected={isSelected(a,'rib','boneless_roast')}/></div>
            <div>Steaks: Bone-in<SelectedMark selected={isSelected(a,'rib','bone_in_steaks')}/> &nbsp; Boneless<SelectedMark selected={isSelected(a,'rib','boneless_steaks')}/></div>
            {!!rib.thickness && <div style={{fontSize:11, color:'#555'}}>Thickness: {String(rib.thickness)}</div>}
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Short Ribs</div>
            <div>Yes<SelectedMark selected={isSelected(a,'short_ribs','yes')}/> &nbsp; No<SelectedMark selected={isSelected(a,'short_ribs','no')}/></div>
          </div>
        </div>

        {/* Hind Quarter */}
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline', textAlign:'center', marginBottom:12}}>Hind Quarter</div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Sirloin</div>
            <div>Roasts<SelectedMark selected={isSelected(a,'sirloin','roasts')}/></div>
            <div>Steaks<SelectedMark selected={isSelected(a,'sirloin','steaks')}/></div>
            <div>Grind<SelectedMark selected={isSelected(a,'sirloin','grind')}/></div>
            {!!getAnswer(a,'sirloin').thickness && <div style={{fontSize:11, color:'#555'}}>Thickness: {String(getAnswer(a,'sirloin').thickness)}</div>}
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Round (one option per half beef)</div>
            <div>Roasts<SelectedMark selected={isSelected(a,'round','roasts')}/></div>
            <div>Steaks<SelectedMark selected={isSelected(a,'round','steaks')}/></div>
            <div>Grind<SelectedMark selected={isSelected(a,'round','grind')}/></div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Short Loin (one option per half beef)</div>
            <div>T-Bone Steaks<SelectedMark selected={isSelected(a,'short_loin','tbone')}/></div>
            {!!getAnswer(a,'short_loin').tbone_thickness && <div style={{fontSize:11,color:'#555'}}>T-Bone Thickness: {String(getAnswer(a,'short_loin').tbone_thickness)}</div>}
            <div>NY Strip &amp; Filet Steaks<SelectedMark selected={isSelected(a,'short_loin','ny_strip_and_filet')}/></div>
            {!!getAnswer(a,'short_loin').strip_thickness && <div style={{fontSize:11,color:'#555'}}>Strip: {String(getAnswer(a,'short_loin').strip_thickness)} | Filet: {String(getAnswer(a,'short_loin').filet_thickness)}</div>}
          </div>

          <div style={{marginBottom:12}}>
            <div style={{fontWeight:'bold', textDecoration:'underline'}}>Flank Steak</div>
            <div>Yes<SelectedMark selected={isSelected(a,'flank','yes')}/> &nbsp; No<SelectedMark selected={isSelected(a,'flank','no')}/></div>
          </div>
        </div>
      </div>

      {/* Bottom row — 4 columns */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16, borderBottom:'2px solid black', paddingBottom:16, marginBottom:16}}>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Stew Meat</div>
          <div>Yes<SelectedMark selected={isSelected(a,'stew_meat','yes')}/> &nbsp; No<SelectedMark selected={isSelected(a,'stew_meat','no')}/></div>
          {!!getAnswer(a,'stew_meat').pounds && <div style={{fontSize:11,color:'#555'}}>{String(getAnswer(a,'stew_meat').pounds)} lbs, {String(getAnswer(a,'stew_meat').pkg_size)} packs</div>}
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Tenderized Round</div>
          <div>Yes<SelectedMark selected={isSelected(a,'tenderized_round','yes')}/> &nbsp; No<SelectedMark selected={isSelected(a,'tenderized_round','no')}/></div>
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline', color:'darkred'}}>Organs</div>
          <div style={{fontSize:11, color:'darkred', marginBottom:4}}>Must be requested at drop-off or unavailable</div>
          <div>Tongue<SelectedMark selected={isSelected(a,'organs','tongue')}/></div>
          <div>Heart<SelectedMark selected={isSelected(a,'organs','heart')}/></div>
          <div>Liver<SelectedMark selected={isSelected(a,'organs','liver')}/></div>
          <div>None<SelectedMark selected={isSelected(a,'organs','none')}/></div>
        </div>
        <div>
          <div style={{fontWeight:'bold', textDecoration:'underline'}}>Bones</div>
          <div>Dog<SelectedMark selected={isSelected(a,'bones','dog')}/></div>
          <div>Soup<SelectedMark selected={isSelected(a,'bones','soup')}/></div>
          <div>None<SelectedMark selected={isSelected(a,'bones','none')}/></div>
        </div>
      </div>

      {/* Packing info */}
      <div style={{marginBottom:16}}>
        <div style={{fontWeight:'bold', textDecoration:'underline', marginBottom:8}}>Packing Information</div>
        <div>Percentage of Fat: <strong>{String(packing.fat_pct || '___')}</strong></div>
        <div>Steak Thickness: <strong>See cuts above</strong></div>
        <div>Roast Weight: <strong>See cuts above</strong></div>
        <div>Pounds Per Pack of Burger: <strong>{String(packing.lbs_per_pack || '___')} lbs/pack</strong></div>
      </div>

      {/* Signature block */}
      <div style={{marginBottom:16, borderTop:'1px solid black', paddingTop:12}}>
        <div style={{marginBottom:8}}>
          Ambulatory at Time of Slaughter: &nbsp;
          Yes _ Initials _ &nbsp;&nbsp; No _ Initials _
        </div>
        <div style={{marginBottom:8, fontSize:11}}>
          I verify the animals I brought in for slaughter have no residual antibiotics or veterinary medication.
        </div>
        <div>Signature: _______________________ &nbsp;&nbsp; Date: ___________</div>
      </div>

      {/* Footer */}
      <div style={{fontSize:10, color:'#555', textAlign:'center', marginTop:16}}>
        Generated by Legacy Land &amp; Cattle Co. — legacylandandcattleco.com
        &nbsp;|&nbsp; Butcher Date: {session.animals?.butcher_date || 'TBD'}
        &nbsp;|&nbsp; {session.purchase_type?.charAt(0).toUpperCase()}{session.purchase_type?.slice(1)} Beef
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
