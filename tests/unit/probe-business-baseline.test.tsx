import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import HomePage from '@/app/page';
import { GET } from '@/app/api/v1/compare/route';
import { metaRepository } from '@/server/meta/repositories/meta-repository';
import { verifiedWebsiteSnapshot } from '@/server/meta/services/verified-catalogue';
import { diffService } from '@/server/services/diff-service';
import { rowImpact } from '@/domain/meta/change-impact';

vi.mock('@/server/meta/repositories/meta-repository',()=>({metaRepository:{getRankingSnapshot:vi.fn()}}));
vi.mock('@/server/meta/services/verified-catalogue',()=>({verifiedWebsiteSnapshot:vi.fn() }));
vi.mock('@/server/services/diff-service',()=>({diffService:{getOrComputeReleaseDiff:vi.fn(),getOrComputeDiff:vi.fn()}}));
vi.mock('@/components/meta/champion-image',()=>({ChampionAvatar:()=>null}));
vi.mock('next/link',()=>({default:({children,href,...props}:any)=>React.createElement('a',{href,...props},children)}));

const change={id:'change_mana_max',entityKind:'champion',entityId:'ahri',rawEntityName:'Ahri',fieldKey:'mana_max',changeType:'increase',rawText:'Maximum mana increased from 80 to 100',before:{state:'known',value:80},after:{state:'known',value:100}} as any;
beforeEach(()=>{
  vi.mocked(metaRepository.getRankingSnapshot).mockResolvedValue({rows:[]} as any);
  vi.mocked(verifiedWebsiteSnapshot).mockResolvedValue({rows:[]} as any);
  vi.mocked(diffService.getOrComputeReleaseDiff).mockResolvedValue({champions:[],changes:[change],summary:{},coverage:{status:'complete'}} as any);
});

describe('business baseline: public homepage',()=>{
  it('control: renders the verified source row supplied by the gate',async()=>{
    vi.mocked(verifiedWebsiteSnapshot).mockResolvedValue({rows:[{archetypeId:'comp_verified',archetypeNameVi:'Verified guide control',selectedSourceBuildId:'build_verified',sourceVotes:[],recommendedBoard:[]}]} as any);
    expect(renderToStaticMarkup(await HomePage())).toContain('Verified guide control');
  });
  it('empty verified dataset must not turn into fixed ranked preview comps',async()=>{
    const html=renderToStaticMarkup(await HomePage());
    expect(html).not.toContain('Rồng Tối Thượng Fast 9');
    expect(html).not.toContain('Moo-Nara Reroll');
  });
  it('home detail link must retain the selected verified build, not an unrelated vote build',async()=>{
    vi.mocked(verifiedWebsiteSnapshot).mockResolvedValue({rows:[{archetypeId:'comp_verified',archetypeNameVi:'Verified guide',selectedSourceBuildId:'build_verified',sourceVotes:{academy:{buildId:'build_other'}},recommendedBoard:[]}]} as any);
    const html=renderToStaticMarkup(await HomePage());
    expect(html).toContain('buildId=build_verified');
    expect(html).not.toContain('buildId=build_other');
  });
  it('no supplied patch changes must not produce hardcoded ability buff claims',async()=>{
    const html=renderToStaticMarkup(await HomePage());
    expect(html).not.toContain('Sát thương kỹ năng Hôn Gió tăng ở mốc 2');
  });
});

describe('business baseline: compare filter and validation',()=>{
  it('mana_max increase remains visible under nerf filter',async()=>{
    expect(rowImpact(change)).toBe('nerf');
    const res=await GET(new NextRequest('http://localhost/api/v1/compare?dataset=real&fromRelease=a&toRelease=b&impact=nerf'));
    expect(res.status).toBe(200);
    expect((await res.json()).data.changes.map((c:any)=>c.id)).toContain(change.id);
  });
  it('mana_max increase must not appear under buff filter',async()=>{
    expect(rowImpact(change)).toBe('nerf');
    const res=await GET(new NextRequest('http://localhost/api/v1/compare?dataset=real&fromRelease=a&toRelease=b&impact=buff'));
    expect(res.status).toBe(200);
    expect((await res.json()).data.changes.map((c:any)=>c.id)).not.toContain(change.id);
  });
  it('unsupported star level is rejected before calling comparison',async()=>{
    const res=await GET(new NextRequest('http://localhost/api/v1/compare?dataset=real&fromRelease=a&toRelease=b&star=9'));
    expect(res.status).toBe(400);
  });
});
