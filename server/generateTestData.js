import pool from './db.js';

// 预设颜色
const COLORS = {
  人物: '#3b82f6',    // blue
  组织: '#10b981',    // green
  地点: '#f59e0b',    // amber
  事件: '#8b5cf6',    // purple
  物品: '#ef4444',    // red
  文件: '#06b6d4',    // cyan
  时间: '#84cc16',    // lime
};

// 实体类型定义
const ENTITY_TYPES = [
  { name: '人物', color: COLORS['人物'], properties: [{ name: '年龄', type: 'number' }, { name: '职业', type: 'text' }, { name: '性别', type: 'enum', options: ['男', '女'] }] },
  { name: '组织', color: COLORS['组织'], properties: [{ name: '类型', type: 'text' }, { name: '成立时间', type: 'date' }] },
  { name: '地点', color: COLORS['地点'], properties: [{ name: '类型', type: 'enum', options: ['城市', '建筑', '区域'] }, { name: '地址', type: 'text' }] },
  { name: '事件', color: COLORS['事件'], properties: [{ name: '发生时间', type: 'date' }, { name: '事件类型', type: 'text' }] },
  { name: '物品', color: COLORS['物品'], properties: [{ name: '类型', type: 'text' }, { name: '价值', type: 'number' }] },
  { name: '文件', color: COLORS['文件'], properties: [{ name: '文件类型', type: 'text' }, { name: '创建时间', type: 'date' }] },
];

// 关系定义
const RELATIONS = [
  { name: '属于', from: '人物', to: '组织', direction: 'directed' },
  { name: '位于', from: '组织', to: '地点', direction: 'directed' },
  { name: '参与', from: '人物', to: '事件', direction: 'bidirectional' },
  { name: '发生地', from: '事件', to: '地点', direction: 'directed' },
  { name: '拥有', from: '人物', to: '物品', direction: 'directed' },
  { name: '关联', from: '事件', to: '文件', direction: 'bidirectional' },
  { name: '认识', from: '人物', to: '人物', direction: 'bidirectional' },
  { name: '合作', from: '组织', to: '组织', direction: 'bidirectional' },
];

// 随机数据生成器
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// 名字池
const PERSON_NAMES = [
  '张伟', '李娜', '王芳', '刘洋', '陈明', '杨静', '赵军', '黄丽', '周杰', '吴敏',
  '徐强', '孙燕', '马超', '朱红', '胡波', '郭晶', '林峰', '何雨', '高翔', '罗丹',
  '郑辉', '梁涛', '谢玲', '唐亮', '韩雪', '冯刚', '董洁', '程威', '曹颖', '袁斌',
  '邓华', '许婷', '傅雷', '沈阳', '曾浩', '吕慧', '苏倩', '蒋磊', '蔡琳', '贾涛',
  '夏雨', '汪洋', '石磊', '熊英', '金鹏', '陆芳', '郝强', '孔燕', '白雪', '成杰',
];

const ORG_NAMES = [
  '科技有限公司', '投资集团', '研究中心', '基金会', '协会', '研究院',
  '设计工作室', '咨询公司', '传媒集团', '物流公司', '银行分行', '医院',
  '学校', '大学', '工厂', '超市连锁', '餐饮集团', '律师事务所', '会计师事务所', '保险公司',
];

const LOCATION_NAMES = [
  '北京市朝阳区', '上海市浦东新区', '广州市天河区', '深圳市南山区', '杭州市西湖区',
  '成都市高新区', '武汉市江汉区', '南京市鼓楼区', '西安市雁塔区', '苏州市姑苏区',
  '天津市和平区', '重庆市渝中区', '长沙市岳麓区', '郑州市金水区', '济南市历下区',
  '青岛市市南区', '大连市中山区', '厦门市思明区', '宁波市海曙区', '福州市鼓楼区',
  '昆明市五华区', '合肥市蜀山区', '南昌市东湖区', '石家庄市长安区', '太原市迎泽区',
  '中央大厦', '科技园区', '工业园区', '商业中心', '金融中心', '研发基地',
  '总部大楼', '数据中心', '展示中心', '培训中心', '服务中心', '运营中心',
];

const EVENT_NAMES = [
  '项目启动会议', '年度总结大会', '产品发布会', '技术研讨会', '战略合作签约',
  '投资洽谈会', '人才招聘会', '客户答谢会', '颁奖典礼', '媒体发布会',
  '紧急事件处理', '安全事故调查', '财务审计', '合规检查', '风险评估会议',
  '产品研发突破', '市场推广活动', '品牌升级发布', '系统上线', '数据迁移完成',
  '业务扩展启动', '并购谈判', '融资完成', '上市准备', '专利申请提交',
  '合同纠纷处理', '知识产权维权', '劳资争议调解', '环保合规整改', '税务审计应对',
];

const ITEM_NAMES = [
  '项目文档', '合同文件', '财务报表', '技术专利', '商业机密',
  '核心设备', '研发样品', '测试数据', '原型模型', '设计图纸',
  '客户名单', '供应商目录', '产品库存', '资金账户', '股权证明',
  '品牌商标', '域名资产', '软件系统', '硬件设施', '办公设备',
];

const FILE_NAMES = [
  '会议纪要', '合同副本', '财务凭证', '技术文档', '人员档案',
  '审计报告', '风险评估表', '合规检查单', '安全记录', '培训资料',
  '项目计划书', '市场分析报告', '竞品调研报告', '客户反馈记录', '供应商评估表',
];

// 案例名称生成
const CASE_NAMES = [
  '企业数字化转型项目', '知识产权维权案件', '商业合同纠纷案例',
  '产品研发合作项目', '市场拓展战略分析', '财务合规审计案件',
  '供应链优化项目', '品牌升级推广案例', '人才发展规划项目', '风险控制体系建设',
];

const CASE_LOCATIONS = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '苏州'];
const CASE_YEARS = ['2020', '2021', '2022', '2023', '2024', '2025'];

async function generateTestData() {
  console.log('开始生成测试数据...\n');

  try {
    // 1. 创建测试 Schema
    console.log('=== 创建测试 Schema ===');
    const schemaResult = await pool.query(
      'INSERT INTO schemas (name, description) VALUES ($1, $2) RETURNING *',
      ['测试知识图谱Schema', '用于演示效果的综合测试Schema，包含人物、组织、地点、事件、物品、文件等实体类型']
    );
    const schemaId = schemaResult.rows[0].id;
    console.log(`Schema 创建成功: ID=${schemaId}`);

    // 2. 创建实体类型
    console.log('\n=== 创建实体类型 ===');
    const entityTypeIds = {};
    for (const entityType of ENTITY_TYPES) {
      const result = await pool.query(
        'INSERT INTO entity_types (schema_id, name, color, properties) VALUES ($1, $2, $3, $4) RETURNING *',
        [schemaId, entityType.name, entityType.color, JSON.stringify(entityType.properties)]
      );
      entityTypeIds[entityType.name] = result.rows[0].id;
      console.log(`  实体类型 "${entityType.name}" 创建成功: ID=${result.rows[0].id}`);
    }

    // 3. 创建关系定义
    console.log('\n=== 创建关系定义 ===');
    for (const relation of RELATIONS) {
      await pool.query(
        'INSERT INTO relations (schema_id, name, from_entity_type, to_entity_type, direction, color, style) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [schemaId, relation.name, relation.from, relation.to, relation.direction, '#9ca3af', 'solid']
      );
      console.log(`  关系 "${relation.name}" (${relation.from} → ${relation.to}) 创建成功`);
    }

    // 4. 创建 10 个案例
    console.log('\n=== 创建案例 ===');
    const caseIds = [];
    for (let i = 0; i < 10; i++) {
      const caseResult = await pool.query(
        'INSERT INTO cases (name, schema_id, location, year, description, tags) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [
          CASE_NAMES[i],
          schemaId,
          CASE_LOCATIONS[i],
          CASE_YEARS[randomInt(0, 5)],
          `这是${CASE_NAMES[i]}的详细描述，用于测试知识图谱展示效果。案例编号: ${i + 1}`,
          JSON.stringify(['测试', '演示', CASE_LOCATIONS[i]])
        ]
      );
      caseIds.push(caseResult.rows[0].id);
      console.log(`  案例 "${CASE_NAMES[i]}" 创建成功: ID=${caseResult.rows[0].id}`);
    }

    // 5. 为每个案例创建实体和关系
    console.log('\n=== 创建实体和关系 ===');
    let totalEntities = 0;
    let totalRelations = 0;

    for (let caseIndex = 0; caseIndex < caseIds.length; caseIndex++) {
      const caseId = caseIds[caseIndex];
      const caseEntities = [];

      // 为每个案例创建 50 个实体
      console.log(`\n案例 ${caseIndex + 1}: ${CASE_NAMES[caseIndex]}`);

      // 按比例分配实体类型
      const entityDistribution = [
        { type: '人物', count: 12, names: PERSON_NAMES },
        { type: '组织', count: 8, names: ORG_NAMES },
        { type: '地点', count: 10, names: LOCATION_NAMES },
        { type: '事件', count: 10, names: EVENT_NAMES },
        { type: '物品', count: 5, names: ITEM_NAMES },
        { type: '文件', count: 5, names: FILE_NAMES },
      ];

      for (const dist of entityDistribution) {
        for (let j = 0; j < dist.count; j++) {
          // 使用唯一编号避免重名
          const uniqueSuffix = `-${caseIndex + 1}-${j + 1}`;
          const baseName = dist.names[j % dist.names.length];
          const name = baseName + uniqueSuffix;

          // 生成随机属性
          const properties = {};
          const entityTypeDef = ENTITY_TYPES.find(e => e.name === dist.type);
          if (entityTypeDef?.properties) {
            for (const prop of entityTypeDef.properties) {
              if (prop.type === 'number') {
                properties[prop.name] = randomInt(1, 100);
              } else if (prop.type === 'text') {
                properties[prop.name] = `测试${prop.name}`;
              } else if (prop.type === 'date') {
                properties[prop.name] = `202${randomInt(0, 5)}-${randomInt(1, 12)}-${randomInt(1, 28)}`;
              } else if (prop.type === 'enum' && prop.options) {
                properties[prop.name] = randomItem(prop.options);
              }
            }
          }

          const entityResult = await pool.query(
            'INSERT INTO case_entities (case_id, name, entity_type, properties) VALUES ($1, $2, $3, $4) RETURNING *',
            [caseId, name, dist.type, JSON.stringify(properties)]
          );
          caseEntities.push({ id: entityResult.rows[0].id, name, type: dist.type });
          totalEntities++;
        }
      }
      console.log(`  创建了 ${caseEntities.length} 个实体`);

      // 为每个案例创建 100 个关系
      let caseRelations = 0;
      const entitiesByType = {};
      caseEntities.forEach(e => {
        if (!entitiesByType[e.type]) entitiesByType[e.type] = [];
        entitiesByType[e.type].push(e);
      });

      // 根据关系定义创建关系
      for (const relation of RELATIONS) {
        const sourceEntities = entitiesByType[relation.from] || [];
        const targetEntities = entitiesByType[relation.to] || [];

        if (sourceEntities.length > 0 && targetEntities.length > 0) {
          // 每种关系类型创建若干个
          const relationCount = Math.min(
            Math.floor(sourceEntities.length * targetEntities.length * 0.3) + 5,
            15
          );

          for (let r = 0; r < relationCount && caseRelations < 100; r++) {
            const source = randomItem(sourceEntities);
            const target = randomItem(targetEntities);

            // 避免自引用
            if (source.id !== target.id) {
              try {
                await pool.query(
                  'INSERT INTO case_relations (case_id, source_entity_id, target_entity_id, relation_type) VALUES ($1, $2, $3, $4) RETURNING *',
                  [caseId, source.id, target.id, relation.name]
                );
                caseRelations++;
                totalRelations++;
              } catch (e) {
                // 忽略重复关系错误
              }
            }
          }
        }
      }

      // 补充额外随机关系以达到目标数量
      while (caseRelations < 100) {
        const source = randomItem(caseEntities);
        const target = randomItem(caseEntities);
        const relation = randomItem(RELATIONS);

        if (source.id !== target.id) {
          try {
            await pool.query(
              'INSERT INTO case_relations (case_id, source_entity_id, target_entity_id, relation_type) VALUES ($1, $2, $3, $4)',
              [caseId, source.id, target.id, relation.name]
            );
            caseRelations++;
            totalRelations++;
          } catch (e) {
            // 忽略错误
          }
        }
      }
      console.log(`  创建了 ${caseRelations} 个关系`);
    }

    console.log('\n=== 数据生成完成 ===');
    console.log(`Schema: 1 个 (ID: ${schemaId})`);
    console.log(`实体类型: ${ENTITY_TYPES.length} 个`);
    console.log(`关系定义: ${RELATIONS.length} 个`);
    console.log(`案例: ${caseIds.length} 个`);
    console.log(`实体总数: ${totalEntities} 个`);
    console.log(`关系总数: ${totalRelations} 个`);

  } catch (error) {
    console.error('生成数据失败:', error);
    throw error;
  }
}

// 执行并关闭连接
generateTestData()
  .then(() => {
    console.log('\n测试数据生成成功！');
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n生成失败:', err.message);
    pool.end();
    process.exit(1);
  });