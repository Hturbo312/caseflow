// 测试优化后的完整提取流程
// cd server && node testFullPipeline.js
import dotenv from 'dotenv';
dotenv.config();

import pool from './db.js';
import { parseCaseText, generateExtractionPlan, extractAllEntities, extractEntities, inferRelations, finalizeCase } from './services/extractionPipeline.js';
import { readFileSync } from 'fs';

async function test() {
  const startTime = Date.now();
  const elapsed = (msg, start) => console.log(`耗时: ${(Date.now() - start).toFixed(2)}ms (${msg})`);

  // 1. 读取测试文档文本（之前测试的曼哈顿项目文本内容）
  const testText = `OneNYC 2050: A Comprehensive Sustainability Plan

New York City's OneNYC 2050 plan represents one of the most ambitious urban sustainability initiatives in the world. Building on the foundation laid by OneNYC 2015, the updated plan expands the city's commitment to environmental justice, climate resilience, and equitable development.

Background and Context

Superstorm Sandy in 2012 devastated coastal communities across New York, particularly in Lower Manhattan, Brooklyn, and Staten Island. The storm exposed critical vulnerabilities in the city's infrastructure and highlighted the urgent need for comprehensive climate adaptation strategies.

In response, Mayor Bill de Blasio launched OneNYC, a comprehensive plan that integrates environmental sustainability, economic vitality, and social equity. The 2050 update builds on decades of environmental planning that began with PlaNYC 2007 under Mayor Michael Bloomberg.

Key Stakeholders

The New York City Mayor's Office for Climate and Environmental Justice leads the initiative, working closely with the New York City Council and multiple city agencies including the Department of City Planning (DCP), the Department of Environmental Protection (DEP), and the Economic Development Corporation (NYCEDC).

Community organizations such as the Chinatown Working Group, the Two Bridges Neighborhood Council, and the Lower East Side Tenement Museum have been instrumental in shaping community-level adaptation strategies.

The Urban Land Institute (ULI) and the Municipal Art Society have provided research support and public engagement platforms. The New York City Environmental Justice Alliance (NYCEJA) has advocated for frontline communities most vulnerable to climate impacts.

Physical Infrastructure Projects

The East Side Coastal Resiliency Project involves constructing a 2.4-mile flood protection system from East 25th Street to Montgomery Street, protecting over 110,000 residents and critical infrastructure.

The Big U, also known as the Dryline, is a proposed flood protection system wrapping around lower Manhattan from West 57th Street to the Lower East Side. Designed by Bjarke Ingels Group (BIG), the concept integrates flood protection with public park space.

The Two Bridges flood resiliency study examined flood risks for the Chinatown and Lower East Side communities, recommending elevated mechanical systems, flood barriers, and community evacuation plans.

Green Infrastructure Initiatives

NYC has invested in urban forestry through the MillionTreesNYC initiative, planting trees across all five boroughs to mitigate urban heat island effects and improve air quality.

The city's green roof program incentivizes building owners to install vegetated roofs that absorb stormwater, reduce energy consumption, and provide habitat for urban wildlife.

Community Benefits and Outcomes

The plan aims to reduce greenhouse gas emissions by 80% by 2050 (80x50 goal), with interim targets of 40% reduction by 2030.

Environmental justice initiatives include the NYC Clean Air Delivery program, which targets freight corridors disproportionately affecting low-income communities of color.

The Resilient Neighborhoods program, developed with the Urban Waterfront Advisory Group, identified specific adaptation strategies for ten waterfront neighborhoods including Hunts Point, Sunset Park, and Coney Island.

Funding and Governance

The city has committed $20 billion in capital funding for climate resiliency projects through 2030, leveraging federal grants from FEMA, the Department of Housing and Urban Development (HUD), and the Army Corps of Engineers.

The NYC Climate Leadership Act, passed in 2019, mandates emissions reductions for buildings over 25,000 square feet, representing 50,000 of the city's largest properties.

Challenges and Lessons Learned

Gentrification concerns have emerged as a significant challenge. Climate resilience improvements in neighborhoods like DUMBO and the Lower East Side have increased property values, potentially displacing the very communities these projects were designed to protect.

The city has responded by integrating anti-displacement measures into its resiliency planning, including mandatory inclusionary housing, community land trusts, and small business protection programs.

Coordination among the 15+ agencies involved in OneNYC implementation remains a persistent challenge. The Mayor's Office for Climate and Environmental Justice serves as the coordinating body, but interagency data sharing and decision-making authority continue to evolve.

Future Directions

OneNYC 2050 envisions a carbon-neutral city by mid-century, powered by offshore wind farms developed through the New York Harbor Wind Energy initiative.

The plan also commits to zero waste by 2030, expanding composting programs, and reducing single-use plastics across city government and commercial sectors.`;

  console.log('=== 优化后完整提取流程测试 ===');
  console.log(`文本长度: ${testText.length} 字符\n`);

  // Step 0: 创建案例
  console.log('--- Step 0: 创建案例 ---');
  const step0Start = Date.now();
  const caseResult = await pool.query(
    "INSERT INTO cases (name, description, schema_id) VALUES ($1, $2, $3) RETURNING *",
    ['测试优化提取 - 并行版', '测试并行提取和分块reread优化', 8]
  );
  const caseId = caseResult.rows[0].id;
  console.log(`案例 ID: ${caseId}\n`);

  // Step 1: 解析文本
  console.log('--- Step 1: 解析文本 ---');
  const step1Start = Date.now();
  const parseResult = await parseCaseText(caseId, testText, 8);
  elapsed('解析文本', step1Start);
  console.log(`段落数: ${parseResult.segments.length}`);
  console.log(`hints: ${parseResult.hint_count}\n`);

  // Step 2: 生成计划
  console.log('--- Step 2: 生成提取计划 ---');
  const step2Start = Date.now();
  const planResult = await generateExtractionPlan(caseId, 8);
  elapsed('生成计划', step2Start);
  console.log(`计划项: ${planResult.plan.length} 个`);
  for (const p of planResult.plan) {
    console.log(`  - ${p.entity_type} (hint: ${p.hint_count})`);
  }
  console.log('');

  // Step 3: 并行提取所有类型实体
  console.log('--- Step 3: 并行提取所有实体类型 ---');
  const step3Start = Date.now();
  const extractResult = await extractAllEntities(caseId, 8);
  elapsed('并行提取全部', step3Start);
  console.log(`总实体: ${extractResult.total}`);
  for (const [type, count] of Object.entries(extractResult.candidates)) {
    console.log(`  ${type}: ${count.length} 个`);
    if (count.length > 0 && count[0].name) {
      console.log(`    示例: ${count[0].name}`);
    }
  }
  console.log('');

  // Step 4: 关系推断（传入候选实体，不依赖DB）
  console.log('--- Step 4: 关系推断 ---');
  const step4Start = Date.now();
  try {
    const allEntities = Object.values(extractResult.candidates).flat();
    console.log(`传入候选实体数: ${allEntities.length}`);
    const relationResult = await inferRelations(caseId, 8, allEntities);
    elapsed('关系推断', step4Start);
    console.log(`推断关系: ${relationResult.relations.length}`);
    for (const r of relationResult.relations.slice(0, 5)) {
      console.log(`  ${r.sourceName} --[${r.name}]--> ${r.targetName} (置信度: ${r.confidence})`);
    }
  } catch (e) {
    elapsed('关系推断（失败）', step4Start);
    console.log(`关系推断失败: ${e.message}`);
  }

  // Step 5: 完成
  console.log('\n--- Step 5: 完成提取 ---');
  await finalizeCase(caseId);
  console.log('完成!');

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== 汇总 ===`);
  console.log(`总耗时: ${totalTime}s`);
  console.log(`案例 ID: ${caseId}`);

  // 关闭连接
  await pool.end();
}

test().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});
