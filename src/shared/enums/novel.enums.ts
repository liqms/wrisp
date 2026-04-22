/**
 * 小说作品类型枚举定义
 * 包含男频和女频小说作品类型的完整分类体系
 */

/**
 * 小说类型受众枚举
 */
export enum NovelAudience {
    MALE = 'male',        // 男频
    FEMALE = 'female'     // 女频
}

/**
 * 男频小说主类型枚举
 */
export enum MaleNovelType {
    // 玄幻
    XUANHUAN = '玄幻',
    // 奇幻
    QIHUAN = '奇幻',
    // 武侠
    WUXIA = '武侠',
    // 仙侠
    XIANXIA = '仙侠',
    // 都市
    DUSHI = '都市',
    // 历史
    LISHI = '历史',
    // 军事
    JUNSHI = '军事',
    // 悬疑
    XUANYI = '悬疑',
    // 科幻
    KEHUAN = '科幻',
    // 游戏
    YOUXI = '游戏',
    // 体育
    TIYU = '体育',
    // 轻小说
    QINGXIAOSHUO = '轻小说',
    // 现实
    XIANSHI = '现实',
    // 短篇
    DUANPIAN = '短篇',
    // 诸天无限
    ZHUTIANWUXIAN = '诸天无限'
}

/**
 * 女频小说主类型枚举
 */
export enum FemaleNovelType {
    // 玄幻言情
    XUANHUANYANQING = '玄幻言情',
    // 仙侠奇缘
    XIANXIAQIYUAN = '仙侠奇缘',
    // 古代言情
    GUDAIYANQING = '古代言情',
    // 现代言情
    XIANDAIYANQING = '现代言情',
    // 浪漫青春
    LANGMANQINGCHUN = '浪漫青春',
    // 悬疑侦探
    XUANYIZHENTAN = '悬疑侦探',
    // 科幻空间
    KEHUANKONGJIAN = '科幻空间',
    // 游戏竞技
    YOUXIJINGJI = '游戏竞技',
    // 轻小说
    QINGXIAOSHUO = '轻小说',
    // 短篇
    DUANPIAN = '短篇',
    // 现实生活
    XIANSHISHENGHUO = '现实生活'
}

/**
 * 男频小说子类型枚举
 */
export enum MaleNovelSubType {
    // 玄幻子类型
    XUANHUAN_DONGFANGXUANHUAN = '东方玄幻',
    XUANHUAN_YISHIDALU = '异世大陆',
    XUANHUAN_GAOWUSHJIE = '高武世界',
    XUANHUAN_WANGCHAOZHENGBA = '王朝争霸',
    
    // 奇幻子类型
    QIHUAN_JIANYUMOFA = '剑与魔法',
    QIHUAN_SHISHIQIHUAN = '史诗奇幻',
    QIHUAN_SHENMIHUANXIANG = '神秘幻想',
    QIHUAN_XIANDAIMOFA = '现代魔法',
    QIHUAN_LISHISHENHUA = '历史神话',
    QIHUAN_LINGLEIHUANXIANG = '另类幻想',
    
    // 武侠子类型
    WUXIA_CHUANTONGWUXIA = '传统武侠',
    WUXIA_WUXIAHUANXIANG = '武侠幻想',
    WUXIA_GUOSHUWUSHUANG = '国术无双',
    WUXIA_GUWUWEILAI = '古武未来',
    WUXIA_WUXIATONGREN = '武侠同人',
    
    // 仙侠子类型
    XIANXIA_XIUZHENWENMING = '修真文明',
    XIANXIA_HUANXIANGXIUZHEN = '幻想修仙',
    XIANXIA_XIANDAIXIUZHEN = '现代修真',
    XIANXIA_SHENHUAXIUZHEN = '神话修真',
    XIANXIA_GUDIANXIANXIA = '古典仙侠',
    
    // 都市子类型
    DUSHI_DUSHISHENGHUO = '都市生活',
    DUSHI_YULEMINGXING = '娱乐明星',
    DUSHI_SHANGZHANZHICHANG = '商战职场',
    DUSHI_YISHUCHAONENG = '异术超能',
    DUSHI_DUSHICHUANGSHUO = '都市传说',
    DUSHI_QINGCHUNXIAOYUAN = '青春校园',
    
    // 历史子类型
    LISHI_JIAKONGLISHI = '架空历史',
    LISHI_LIANGSONGYUANMING = '两宋元明',
    LISHI_WAIGUOLISHI = '外国历史',
    LISHI_SHANGGUXIANQIN = '上古先秦',
    LISHI_QINHANSANGUO = '秦汉三国',
    LISHI_LIANGJINSUITANG = '两晋隋唐',
    LISHI_WUDAISHIGUO = '五代十国',
    LISHI_QINGSHIMINGUO = '清史民国',
    LISHI_LISHIZHUANJI = '历史传记',
    LISHI_MINJIANCHUANSHUO = '民间传说',
    
    // 军事子类型
    JUNSHI_ZHANZHENGHUANXIANG = '战争幻想',
    JUNSHI_DIEZHANTEGONG = '谍战特工',
    JUNSHI_JUNLVSHENGYA = '军旅生涯',
    JUNSHI_KANGZHANFENGHUO = '抗战烽火',
    JUNSHI_JUNSHIZHANZHENG = '军事战争',
    
    // 悬疑子类型
    XUANYI_XUANYIZHENTAN = '悬疑侦探',
    XUANYI_GUIMIXUANYI = '诡秘悬疑',
    XUANYI_TANXIANSHENGCUN = '探险生存',
    XUANYI_QIMIAOSHIJIE = '奇妙世界',
    XUANYI_GUJINCHUANQI = '古今传奇',
    
    // 科幻子类型
    KEHUAN_XINGJIWENMING = '星际文明',
    KEHUAN_SHIKONGCHUANSUO = '时空穿梭',
    KEHUAN_WEILAISHIJIE = '未来世界',
    KEHUAN_GUWUJIJIA = '古武机甲',
    KEHUAN_CHAOJIKEGI = '超级科技',
    KEHUAN_JINHUABIANYI = '进化变异',
    KEHUAN_MOSHIWEIJI = '末世危机',
    
    // 游戏子类型
    YOUXI_DIANZIJINGJI = '电子竞技',
    YOUXI_XUNIWANGYOU = '虚拟网游',
    YOUXI_YOUXIYIJIE = '游戏异界',
    YOUXI_YOUXIXITONG = '游戏系统',
    YOUXI_YOUXIZHUBO = '游戏主播',
    
    // 体育子类型
    TIYU_TIYUSAISHI = '体育赛事',
    TIYU_LANQIUYUNDONG = '篮球运动',
    TIYU_ZUQIUYUNDONG = '足球运动',
    
    // 轻小说子类型
    QINGXIAOSHUO_YUANSHENGHUANXIANG = '原生幻想',
    QINGXIAOSHUO_YANSHENGTONGREN = '衍生同人',
    QINGXIAOSHUO_GAOXIAOTUCAO = '搞笑吐槽',
    QINGXIAOSHUO_LIANAIRICHANG = '恋爱日常',
    
    // 现实子类型
    XIANSHI_JIATINGLUNLI = '家庭伦理',
    XIANSHI_RENJIANBAITAI = '人间百态',
    XIANSHI_NVXINGTICAI = '女性题材',
    XIANSHI_SHEHUIXUANYI = '社会悬疑',
    XIANSHI_SHIDAIXUSHI = '时代叙事',
    XIANSHI_QINGNIANGUSHI = '青年故事',
    
    // 短篇子类型
    DUANPIAN_YINGSHIJUBEN = '影视剧本',
    DUANPIAN_PINGLUNWENJI = '评论文集',
    DUANPIAN_SHENGHUOSUIBI = '生活随笔',
    DUANPIAN_MEIWENYOUJI = '美文游记',
    DUANPIAN_DUANPIANXIAOSHUO = '短篇小说',
    DUANPIAN_SHIGESANWEN = '诗歌散文',
    DUANPIAN_RENWUZHUANJI = '人物传记',
    DUANPIAN_DUANGUSHI = '短故事',
    
    // 诸天无限子类型
    ZHUTIANWUXIAN_WUXIAN = '无限',
    ZHUTIANWUXIAN_ZHUTIAN = '诸天',
    ZHUTIANWUXIAN_ZONGMAN = '综漫'
}

/**
 * 女频小说子类型枚举
 */
export enum FemaleNovelSubType {
    // 玄幻言情子类型
    XUANHUANYANQING_DONGFANGXUANHUAN = '东方玄幻',
    XUANHUANYANQING_YISHIDALU = '异世大陆',
    XUANHUANYANQING_YUANGUSHENHUA = '远古神话',
    XUANHUANYANQING_YIZULIANQING = '异族恋情',
    XUANHUANYANQING_MOFAHUANQING = '魔法幻情',
    XUANHUANYANQING_XIFANGQIHUAN = '西方奇幻',
    XUANHUANYANQING_YINENGCHAOSHU = '异能超术',
    
    // 仙侠奇缘子类型
    XIANXIAQIYUAN_WUXIAQINGYUAN = '武侠情缘',
    XIANXIAQIYUAN_GUDIANXIANXIA = '古典仙侠',
    XIANXIAQIYUAN_XIANDAIXIUZHEN = '现代修真',
    XIANXIAQIYUAN_YUANGUHONGHUANG = '远古洪荒',
    XIANXIAQIYUAN_XIANLVQIYUAN = '仙侣奇缘',
    
    // 古代言情子类型
    GUDAIYANQING_NVZUNWANGCHAO = '女尊王朝',
    GUDAIYANQING_GUDIANJIAKONG = '古典架空',
    GUDAIYANQING_GUDAIQINGYUAN = '古代情缘',
    GUDAIYANQING_CHUANYUEQIQING = '穿越奇情',
    GUDAIYANQING_GONGWEIZHADOU = '宫闱宅斗',
    GUDAIYANQING_JINGSHANGZHONGTIAN = '经商种田',
    GUDAIYANQING_XIFANGSHIKONG = '西方时空',
    GUDAIYANQING_QINGCHUANMINGUO = '清穿民国',
    GUDAIYANQING_SHANGGUMANHUANG = '上古蛮荒',
    GUDAIYANQING_REXUEJIANGHU = '热血江湖',
    
    // 现代言情子类型
    XIANDAIYANQING_DUSHISHENGHUO = '都市生活',
    XIANDAIYANQING_HUNLIANQINGYUAN = '婚恋情缘',
    XIANDAIYANQING_YULEMINGXING = '娱乐明星',
    XIANDAIYANQING_SHANGZHANZHICHANG = '商战职场',
    XIANDAIYANQING_DUSHIYINENG = '都市异能',
    XIANDAIYANQING_HAOMENSHIJIA = '豪门世家',
    XIANDAIYANQING_JIDAOJIANGHU = '极道江湖',
    XIANDAIYANQING_MINGUOQINGYUAN = '民国情缘',
    XIANDAIYANQING_YIGUOQINGYUAN = '异国情缘',
    
    // 浪漫青春子类型
    LANGMANQINGCHUN_PANNICHENGZHANG = '叛逆成长',
    LANGMANQINGCHUN_QINGCHUNCHUNAI = '青春纯爱',
    LANGMANQINGCHUN_QINGCHUNTENGTONG = '青春疼痛',
    LANGMANQINGCHUN_QINGCHUNXIAOYUAN = '青春校园',
    
    // 悬疑侦探子类型
    XUANYIZHENTAN_TUILIZHENTAN = '推理侦探',
    XUANYIZHENTAN_KONGBUJINGSONG = '恐怖惊悚',
    XUANYIZHENTAN_XUANYITANXIAN = '悬疑探险',
    XUANYIZHENTAN_QIMIAOSHIJIE = '奇妙世界',
    XUANYIZHENTAN_SHENMIWENHUA = '神秘文化',
    XUANYIZHENTAN_YOUMINGQINGYUAN = '幽冥情缘',
    
    // 科幻空间子类型
    KEHUANKONGJIAN_XINGJILIANGE = '星际恋歌',
    KEHUANKONGJIAN_SHIKONGCHUANSUO = '时空穿梭',
    KEHUANKONGJIAN_WEILAISHIJIE = '未来世界',
    KEHUANKONGJIAN_GUWUJIJIA = '古武机甲',
    KEHUANKONGJIAN_CHAOJIKEGI = '超级科技',
    KEHUANKONGJIAN_JINHUABIANYI = '进化变异',
    KEHUANKONGJIAN_MOSHIWEIJI = '末世危机',
    
    // 游戏竞技子类型
    YOUXIJINGJI_DIANZIJINGJI = '电子竞技',
    YOUXIJINGJI_WANGYOUQINGYUAN = '网游情缘',
    YOUXIJINGJI_YOUXIYIJIE = '游戏异界',
    YOUXIJINGJI_TIYUJINGJI = '体育竞技',
    
    // 轻小说子类型
    QINGXIAOSHUO_TONGRENYANSHENG = '同人衍生',
    QINGXIAOSHUO_WEIMEIHUANXIANG = '唯美幻想',
    QINGXIAOSHUO_MENGXIBIANSHEN = '萌系变身',
    QINGXIAOSHUO_QINGCHUNRICHANG = '青春日常',
    QINGXIAOSHUO_GAOXIAOTUCAO = '搞笑吐槽',
    QINGXIAOSHUO_GUDIANYANSHENG = '古典衍生',
    QINGXIAOSHUO_YINGSHIYANSHENG = '影视衍生',
    QINGXIAOSHUO_DONGMANYANSHENG = '动漫衍生',
    QINGXIAOSHUO_QITAYANSHENG = '其他衍生',
    
    // 短篇子类型
    DUANPIAN_YINGSHIJUBEN = '影视剧本',
    DUANPIAN_PINGLUNWENJI = '评论文集',
    DUANPIAN_SHENGHUOSUIBI = '生活随笔',
    DUANPIAN_MEIWENYOUJI = '美文游记',
    DUANPIAN_DUANPIANXIAOSHUO = '短篇小说',
    DUANPIAN_SHIGESANWEN = '诗歌散文',
    DUANPIAN_RENWUZHUANJI = '人物传记',
    DUANPIAN_DUANGUSHI = '短故事',
    
    // 现实生活子类型
    XIANSHISHENGHUO_JIAYUQINGGAN = '家与情感',
    XIANSHISHENGHUO_HANGYERENSHENG = '行业人生',
    XIANSHISHENGHUO_TANSUOKEHUAN = '探索科幻',
    XIANSHISHENGHUO_RENWENBOLAN = '人文博览'
}

/**
 * 小说类型信息接口
 */
export interface NovelTypeInfo {
    type: string                    // 类型名称
    audience: NovelAudience        // 受众群体
    description?: string            // 类型描述
    subTypes: string[]              // 子类型列表
}

/**
 * 男频小说类型信息映射
 */
export const MALE_NOVEL_TYPES: Record<MaleNovelType, NovelTypeInfo> = {
    [MaleNovelType.XUANHUAN]: {
        type: '玄幻',
        audience: NovelAudience.MALE,
        description: '架空世界，明确的修炼升级体系，展现个体玄异能力及恩怨情仇',
        subTypes: [
            MaleNovelSubType.XUANHUAN_DONGFANGXUANHUAN,
            MaleNovelSubType.XUANHUAN_YISHIDALU,
            MaleNovelSubType.XUANHUAN_GAOWUSHJIE,
            MaleNovelSubType.XUANHUAN_WANGCHAOZHENGBA
        ]
    },
    [MaleNovelType.QIHUAN]: {
        type: '奇幻',
        audience: NovelAudience.MALE,
        description: '强调作者奇特的想象力，核心并非固定的世界模式或"剑与魔法"，不限于西方奇幻',
        subTypes: [
            MaleNovelSubType.QIHUAN_JIANYUMOFA,
            MaleNovelSubType.QIHUAN_SHISHIQIHUAN,
            MaleNovelSubType.QIHUAN_SHENMIHUANXIANG,
            MaleNovelSubType.QIHUAN_XIANDAIMOFA,
            MaleNovelSubType.QIHUAN_LISHISHENHUA,
            MaleNovelSubType.QIHUAN_LINGLEIHUANXIANG
        ]
    },
    [MaleNovelType.WUXIA]: {
        type: '武侠',
        audience: NovelAudience.MALE,
        description: '以江湖为主，等级上限不跨界。融入重生、穿越、系统流等现代元素，背景可从中古到现代，甚至西方',
        subTypes: [
            MaleNovelSubType.WUXIA_CHUANTONGWUXIA,
            MaleNovelSubType.WUXIA_WUXIAHUANXIANG,
            MaleNovelSubType.WUXIA_GUOSHUWUSHUANG,
            MaleNovelSubType.WUXIA_GUWUWEILAI,
            MaleNovelSubType.WUXIA_WUXIATONGREN
        ]
    },
    [MaleNovelType.XIANXIA]: {
        type: '仙侠',
        audience: NovelAudience.MALE,
        description: '华夏神话体系的延续，多包含炼丹、制符、法宝、元婴、洪荒等元素。背景可为现代都市或架空世界',
        subTypes: [
            MaleNovelSubType.XIANXIA_XIUZHENWENMING,
            MaleNovelSubType.XIANXIA_HUANXIANGXIUZHEN,
            MaleNovelSubType.XIANXIA_XIANDAIXIUZHEN,
            MaleNovelSubType.XIANXIA_SHENHUAXIUZHEN,
            MaleNovelSubType.XIANXIA_GUDIANXIANXIA
        ]
    },
    [MaleNovelType.DUSHI]: {
        type: '都市',
        audience: NovelAudience.MALE,
        description: '以上世纪70年代以后的现实或类现实生活为背景，可包含穿越、重生、异能等元素',
        subTypes: [
            MaleNovelSubType.DUSHI_DUSHISHENGHUO,
            MaleNovelSubType.DUSHI_YULEMINGXING,
            MaleNovelSubType.DUSHI_SHANGZHANZHICHANG,
            MaleNovelSubType.DUSHI_YISHUCHAONENG,
            MaleNovelSubType.DUSHI_DUSHICHUANGSHUO,
            MaleNovelSubType.DUSHI_QINGCHUNXIAOYUAN
        ]
    },
    [MaleNovelType.LISHI]: {
        type: '历史',
        audience: NovelAudience.MALE,
        description: '以中国或世界的真实/虚构历史为背景，人物可穿越或真实存在，情节可改变或遵循历史',
        subTypes: [
            MaleNovelSubType.LISHI_JIAKONGLISHI,
            MaleNovelSubType.LISHI_LIANGSONGYUANMING,
            MaleNovelSubType.LISHI_WAIGUOLISHI,
            MaleNovelSubType.LISHI_SHANGGUXIANQIN,
            MaleNovelSubType.LISHI_QINHANSANGUO,
            MaleNovelSubType.LISHI_LIANGJINSUITANG,
            MaleNovelSubType.LISHI_WUDAISHIGUO,
            MaleNovelSubType.LISHI_QINGSHIMINGUO,
            MaleNovelSubType.LISHI_LISHIZHUANJI,
            MaleNovelSubType.LISHI_MINJIANCHUANSHUO
        ]
    },
    [MaleNovelType.JUNSHI]: {
        type: '军事',
        audience: NovelAudience.MALE,
        description: '以现代社会、一战/二战、甲午战争、抗日等为背景的热血争霸题材，展现个人或团队作战能力',
        subTypes: [
            MaleNovelSubType.JUNSHI_ZHANZHENGHUANXIANG,
            MaleNovelSubType.JUNSHI_DIEZHANTEGONG,
            MaleNovelSubType.JUNSHI_JUNLVSHENGYA,
            MaleNovelSubType.JUNSHI_KANGZHANFENGHUO,
            MaleNovelSubType.JUNSHI_JUNSHIZHANZHENG
        ]
    },
    [MaleNovelType.XUANYI]: {
        type: '悬疑',
        audience: NovelAudience.MALE,
        description: '包含风水堪舆、神鬼志怪、探墓、悬疑谜案、心理游戏、恐怖奇谈等科学难以解释的元素',
        subTypes: [
            MaleNovelSubType.XUANYI_XUANYIZHENTAN,
            MaleNovelSubType.XUANYI_GUIMIXUANYI,
            MaleNovelSubType.XUANYI_TANXIANSHENGCUN,
            MaleNovelSubType.XUANYI_QIMIAOSHIJIE,
            MaleNovelSubType.XUANYI_GUJINCHUANQI
        ]
    },
    [MaleNovelType.KEHUAN]: {
        type: '科幻',
        audience: NovelAudience.MALE,
        description: '基于科学技术远景或社会发展构想的幻想小说',
        subTypes: [
            MaleNovelSubType.KEHUAN_XINGJIWENMING,
            MaleNovelSubType.KEHUAN_SHIKONGCHUANSUO,
            MaleNovelSubType.KEHUAN_WEILAISHIJIE,
            MaleNovelSubType.KEHUAN_GUWUJIJIA,
            MaleNovelSubType.KEHUAN_CHAOJIKEGI,
            MaleNovelSubType.KEHUAN_JINHUABIANYI,
            MaleNovelSubType.KEHUAN_MOSHIWEIJI
        ]
    },
    [MaleNovelType.YOUXI]: {
        type: '游戏',
        audience: NovelAudience.MALE,
        description: '所有以游戏元素（如怀念、幻想、现实化等）为核心的创作',
        subTypes: [
            MaleNovelSubType.YOUXI_DIANZIJINGJI,
            MaleNovelSubType.YOUXI_XUNIWANGYOU,
            MaleNovelSubType.YOUXI_YOUXIYIJIE,
            MaleNovelSubType.YOUXI_YOUXIXITONG,
            MaleNovelSubType.YOUXI_YOUXIZHUBO
        ]
    },
    [MaleNovelType.TIYU]: {
        type: '体育',
        audience: NovelAudience.MALE,
        description: '所有以运动、竞技项目为主要元素的创作',
        subTypes: [
            MaleNovelSubType.TIYU_TIYUSAISHI,
            MaleNovelSubType.TIYU_LANQIUYUNDONG,
            MaleNovelSubType.TIYU_ZUQIUYUNDONG
        ]
    },
    [MaleNovelType.QINGXIAOSHUO]: {
        type: '轻小说',
        audience: NovelAudience.MALE,
        description: '面向喜爱二次元内容的青少年，写作手法灵活，阅读体验轻松，注重创意与故事性',
        subTypes: [
            MaleNovelSubType.QINGXIAOSHUO_YUANSHENGHUANXIANG,
            MaleNovelSubType.QINGXIAOSHUO_YANSHENGTONGREN,
            MaleNovelSubType.QINGXIAOSHUO_GAOXIAOTUCAO,
            MaleNovelSubType.QINGXIAOSHUO_LIANAIRICHANG
        ]
    },
    [MaleNovelType.XIANSHI]: {
        type: '现实',
        audience: NovelAudience.MALE,
        description: '以当代现实职场为背景，描写人物奋斗、生活和情感的作品',
        subTypes: [
            MaleNovelSubType.XIANSHI_JIATINGLUNLI,
            MaleNovelSubType.XIANSHI_RENJIANBAITAI,
            MaleNovelSubType.XIANSHI_NVXINGTICAI,
            MaleNovelSubType.XIANSHI_SHEHUIXUANYI,
            MaleNovelSubType.XIANSHI_SHIDAIXUSHI,
            MaleNovelSubType.XIANSHI_QINGNIANGUSHI
        ]
    },
    [MaleNovelType.DUANPIAN]: {
        type: '短篇',
        audience: NovelAudience.MALE,
        description: '六十万字以内的文学作品，包括各类短篇小说、散文、诗歌、童话等',
        subTypes: [
            MaleNovelSubType.DUANPIAN_YINGSHIJUBEN,
            MaleNovelSubType.DUANPIAN_PINGLUNWENJI,
            MaleNovelSubType.DUANPIAN_SHENGHUOSUIBI,
            MaleNovelSubType.DUANPIAN_MEIWENYOUJI,
            MaleNovelSubType.DUANPIAN_DUANPIANXIAOSHUO,
            MaleNovelSubType.DUANPIAN_SHIGESANWEN,
            MaleNovelSubType.DUANPIAN_RENWUZHUANJI,
            MaleNovelSubType.DUANPIAN_DUANGUSHI
        ]
    },
    [MaleNovelType.ZHUTIANWUXIAN]: {
        type: '诸天无限',
        audience: NovelAudience.MALE,
        description: '以穿梭多个不同世界观的原著世界或原创世界为主体的小说',
        subTypes: [
            MaleNovelSubType.ZHUTIANWUXIAN_WUXIAN,
            MaleNovelSubType.ZHUTIANWUXIAN_ZHUTIAN,
            MaleNovelSubType.ZHUTIANWUXIAN_ZONGMAN
        ]
    }
}

/**
 * 女频小说类型信息映射
 */
export const FEMALE_NOVEL_TYPES: Record<FemaleNovelType, NovelTypeInfo> = {
    [FemaleNovelType.XUANHUANYANQING]: {
        type: '玄幻言情',
        audience: NovelAudience.FEMALE,
        description: '',
        subTypes: [
            FemaleNovelSubType.XUANHUANYANQING_DONGFANGXUANHUAN,
            FemaleNovelSubType.XUANHUANYANQING_YISHIDALU,
            FemaleNovelSubType.XUANHUANYANQING_YUANGUSHENHUA,
            FemaleNovelSubType.XUANHUANYANQING_YIZULIANQING,
            FemaleNovelSubType.XUANHUANYANQING_MOFAHUANQING,
            FemaleNovelSubType.XUANHUANYANQING_XIFANGQIHUAN,
            FemaleNovelSubType.XUANHUANYANQING_YINENGCHAOSHU
        ]
    },
    [FemaleNovelType.XIANXIAQIYUAN]: {
        type: '仙侠奇缘',
        audience: NovelAudience.FEMALE,
        description: '',
        subTypes: [
            FemaleNovelSubType.XIANXIAQIYUAN_WUXIAQINGYUAN,
            FemaleNovelSubType.XIANXIAQIYUAN_GUDIANXIANXIA,
            FemaleNovelSubType.XIANXIAQIYUAN_XIANDAIXIUZHEN,
            FemaleNovelSubType.XIANXIAQIYUAN_YUANGUHONGHUANG,
            FemaleNovelSubType.XIANXIAQIYUAN_XIANLVQIYUAN
        ]
    },
    [FemaleNovelType.GUDAIYANQING]: {
        type: '古代言情',
        audience: NovelAudience.FEMALE,
        description: '',
        subTypes: [
            FemaleNovelSubType.GUDAIYANQING_NVZUNWANGCHAO,
            FemaleNovelSubType.GUDAIYANQING_GUDIANJIAKONG,
            FemaleNovelSubType.GUDAIYANQING_GUDAIQINGYUAN,
            FemaleNovelSubType.GUDAIYANQING_CHUANYUEQIQING,
            FemaleNovelSubType.GUDAIYANQING_GONGWEIZHADOU,
            FemaleNovelSubType.GUDAIYANQING_JINGSHANGZHONGTIAN,
            FemaleNovelSubType.GUDAIYANQING_XIFANGSHIKONG,
            FemaleNovelSubType.GUDAIYANQING_QINGCHUANMINGUO,
            FemaleNovelSubType.GUDAIYANQING_SHANGGUMANHUANG,
            FemaleNovelSubType.GUDAIYANQING_REXUEJIANGHU
        ]
    },
    [FemaleNovelType.XIANDAIYANQING]: {
        type: '现代言情',
        audience: NovelAudience.FEMALE,
        description: '',
        subTypes: [
            FemaleNovelSubType.XIANDAIYANQING_DUSHISHENGHUO,
            FemaleNovelSubType.XIANDAIYANQING_HUNLIANQINGYUAN,
            FemaleNovelSubType.XIANDAIYANQING_YULEMINGXING,
            FemaleNovelSubType.XIANDAIYANQING_SHANGZHANZHICHANG,
            FemaleNovelSubType.XIANDAIYANQING_DUSHIYINENG,
            FemaleNovelSubType.XIANDAIYANQING_HAOMENSHIJIA,
            FemaleNovelSubType.XIANDAIYANQING_JIDAOJIANGHU,
            FemaleNovelSubType.XIANDAIYANQING_MINGUOQINGYUAN,
            FemaleNovelSubType.XIANDAIYANQING_YIGUOQINGYUAN
        ]
    },
    [FemaleNovelType.LANGMANQINGCHUN]: {
        type: '浪漫青春',
        audience: NovelAudience.FEMALE,
        description: '',
        subTypes: [
            FemaleNovelSubType.LANGMANQINGCHUN_PANNICHENGZHANG,
            FemaleNovelSubType.LANGMANQINGCHUN_QINGCHUNCHUNAI,
            FemaleNovelSubType.LANGMANQINGCHUN_QINGCHUNTENGTONG,
            FemaleNovelSubType.LANGMANQINGCHUN_QINGCHUNXIAOYUAN
        ]
    },
    [FemaleNovelType.XUANYIZHENTAN]: {
        type: '悬疑侦探',
        audience: NovelAudience.FEMALE,
        description: '',
        subTypes: [
            FemaleNovelSubType.XUANYIZHENTAN_TUILIZHENTAN,
            FemaleNovelSubType.XUANYIZHENTAN_KONGBUJINGSONG,
            FemaleNovelSubType.XUANYIZHENTAN_XUANYITANXIAN,
            FemaleNovelSubType.XUANYIZHENTAN_QIMIAOSHIJIE,
            FemaleNovelSubType.XUANYIZHENTAN_SHENMIWENHUA,
            FemaleNovelSubType.XUANYIZHENTAN_YOUMINGQINGYUAN
        ]
    },
    [FemaleNovelType.KEHUANKONGJIAN]: {
        type: '科幻空间',
        audience: NovelAudience.FEMALE,
        description: '',
        subTypes: [
            FemaleNovelSubType.KEHUANKONGJIAN_XINGJILIANGE,
            FemaleNovelSubType.KEHUANKONGJIAN_SHIKONGCHUANSUO,
            FemaleNovelSubType.KEHUANKONGJIAN_WEILAISHIJIE,
            FemaleNovelSubType.KEHUANKONGJIAN_GUWUJIJIA,
            FemaleNovelSubType.KEHUANKONGJIAN_CHAOJIKEGI,
            FemaleNovelSubType.KEHUANKONGJIAN_JINHUABIANYI,
            FemaleNovelSubType.KEHUANKONGJIAN_MOSHIWEIJI
        ]
    },
    [FemaleNovelType.YOUXIJINGJI]: {
        type: '游戏竞技',
        audience: NovelAudience.FEMALE,
        description: '',
        subTypes: [
            FemaleNovelSubType.YOUXIJINGJI_DIANZIJINGJI,
            FemaleNovelSubType.YOUXIJINGJI_WANGYOUQINGYUAN,
            FemaleNovelSubType.YOUXIJINGJI_YOUXIYIJIE,
            FemaleNovelSubType.YOUXIJINGJI_TIYUJINGJI
        ]
    },
    [FemaleNovelType.QINGXIAOSHUO]: {
        type: '轻小说',
        audience: NovelAudience.FEMALE,
        description: '以各类原著作品为背景衍生出来进行再创作的作品',
        subTypes: [
            FemaleNovelSubType.QINGXIAOSHUO_TONGRENYANSHENG,
            FemaleNovelSubType.QINGXIAOSHUO_WEIMEIHUANXIANG,
            FemaleNovelSubType.QINGXIAOSHUO_MENGXIBIANSHEN,
            FemaleNovelSubType.QINGXIAOSHUO_QINGCHUNRICHANG,
            FemaleNovelSubType.QINGXIAOSHUO_GAOXIAOTUCAO,
            FemaleNovelSubType.QINGXIAOSHUO_GUDIANYANSHENG,
            FemaleNovelSubType.QINGXIAOSHUO_YINGSHIYANSHENG,
            FemaleNovelSubType.QINGXIAOSHUO_DONGMANYANSHENG,
            FemaleNovelSubType.QINGXIAOSHUO_QITAYANSHENG
        ]
    },
    [FemaleNovelType.DUANPIAN]: {
        type: '短篇',
        audience: NovelAudience.FEMALE,
        description: '六十万字以内的文学作品，包括了各类型短篇小说、散文、诗歌、童话故事等各种类型',
        subTypes: [
            FemaleNovelSubType.DUANPIAN_YINGSHIJUBEN,
            FemaleNovelSubType.DUANPIAN_PINGLUNWENJI,
            FemaleNovelSubType.DUANPIAN_SHENGHUOSUIBI,
            FemaleNovelSubType.DUANPIAN_MEIWENYOUJI,
            FemaleNovelSubType.DUANPIAN_DUANPIANXIAOSHUO,
            FemaleNovelSubType.DUANPIAN_SHIGESANWEN,
            FemaleNovelSubType.DUANPIAN_RENWUZHUANJI,
            FemaleNovelSubType.DUANPIAN_DUANGUSHI
        ]
    },
    [FemaleNovelType.XIANSHISHENGHUO]: {
        type: '现实生活',
        audience: NovelAudience.FEMALE,
        description: '展现源于现实生活的感动，敬畏生命，感恩人生，奋斗热诚',
        subTypes: [
            FemaleNovelSubType.XIANSHISHENGHUO_JIAYUQINGGAN,
            FemaleNovelSubType.XIANSHISHENGHUO_HANGYERENSHENG,
            FemaleNovelSubType.XIANSHISHENGHUO_TANSUOKEHUAN,
            FemaleNovelSubType.XIANSHISHENGHUO_RENWENBOLAN
        ]
    }
}

/**
 * 工具函数：根据受众获取所有主类型
 */
export function getNovelTypesByAudience(audience: NovelAudience): NovelTypeInfo[] {
    if (audience === NovelAudience.MALE) {
        return Object.values(MALE_NOVEL_TYPES)
    } else {
        return Object.values(FEMALE_NOVEL_TYPES)
    }
}

/**
 * 工具函数：根据主类型获取子类型列表
 */
export function getSubTypesByMainType(mainType: string, audience: NovelAudience): string[] {
    if (audience === NovelAudience.MALE) {
        const typeInfo = MALE_NOVEL_TYPES[mainType as MaleNovelType]
        return typeInfo?.subTypes || []
    } else {
        const typeInfo = FEMALE_NOVEL_TYPES[mainType as FemaleNovelType]
        return typeInfo?.subTypes || []
    }
}

/**
 * 工具函数：获取所有主类型名称
 */
export function getAllMainTypes(audience: NovelAudience): string[] {
    if (audience === NovelAudience.MALE) {
        return Object.values(MaleNovelType)
    } else {
        return Object.values(FemaleNovelType)
    }
}

/**
 * 工具函数：验证主类型是否有效
 */
export function isValidMainType(mainType: string, audience: NovelAudience): boolean {
    if (audience === NovelAudience.MALE) {
        return Object.values(MaleNovelType).includes(mainType as MaleNovelType)
    } else {
        return Object.values(FemaleNovelType).includes(mainType as FemaleNovelType)
    }
}

/**
 * 工具函数：验证子类型是否有效
 */
export function isValidSubType(subType: string, mainType: string, audience: NovelAudience): boolean {
    const subTypes = getSubTypesByMainType(mainType, audience)
    return subTypes.includes(subType)
}

/**
 * 工具函数：根据子类型获取主类型
 */
export function getMainTypeBySubType(subType: string, audience: NovelAudience): string | undefined {
    const types = audience === NovelAudience.MALE ? MALE_NOVEL_TYPES : FEMALE_NOVEL_TYPES
    
    for (const [mainType, typeInfo] of Object.entries(types)) {
        if (typeInfo.subTypes.includes(subType)) {
            return mainType
        }
    }
    return undefined
}

/**
 * 工具函数：搜索小说类型
 */
export function searchNovelTypes(query: string, audience: NovelAudience): NovelTypeInfo[] {
    const types = getNovelTypesByAudience(audience)
    const lowerQuery = query.toLowerCase()
    
    return types.filter(typeInfo => 
        typeInfo.type.toLowerCase().includes(lowerQuery) ||
        typeInfo.description?.toLowerCase().includes(lowerQuery) ||
        typeInfo.subTypes.some(subType => subType.toLowerCase().includes(lowerQuery))
    )
}

export default {
    NovelAudience,
    MaleNovelType,
    FemaleNovelType,
    MaleNovelSubType,
    FemaleNovelSubType,
    MALE_NOVEL_TYPES,
    FEMALE_NOVEL_TYPES,
    getNovelTypesByAudience,
    getSubTypesByMainType,
    getAllMainTypes,
    isValidMainType,
    isValidSubType,
    getMainTypeBySubType,
    searchNovelTypes
}