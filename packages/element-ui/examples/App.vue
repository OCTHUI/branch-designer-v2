<template>
    <div id="app">
        <div class="_fc-top-bar">
            <div class="_fc-top-logo">
                <img class="_fc-logo-img" src="../src/style/images/hsg_logo.png" alt="logo"/>
                <span class="_fc-logo-text">Branch Designer V2.0</span>
            </div>
        </div>
        <fc-designer ref="designer" :config="config" :handle="handle" :locale="locale">
            <template #handle>
                <div class="handle">
                    <el-dropdown>
                        <div class="el-dropdown-link">
                            <span>{{ t('language.import') }}</span>
                            <el-icon class="el-icon--right">
                                <arrow-down/>
                            </el-icon>
                        </div>
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item @click="setJson">{{ t('language.importJson') }}</el-dropdown-item>
                                <el-dropdown-item @click="setOption">{{ t('language.importOptions') }}</el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                    <el-dropdown>
                        <div class="el-dropdown-link">
                            <span>{{ t('language.export') }}</span>
                            <el-icon class="el-icon--right">
                                <arrow-down/>
                            </el-icon>
                        </div>
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item @click="showJson">{{ t('language.exportJson') }}</el-dropdown-item>
                                <el-dropdown-item @click="showOption">{{ t('language.exportOptions') }}</el-dropdown-item>
                                <el-dropdown-item @click="copyUrl">{{ t('language.exportPreviewUrl') }}</el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                </div>
            </template>
        </fc-designer>


        <el-dialog :title="title[type]" v-model="state" class="_fc-t-dialog">
            <div ref="editor" v-if="state"></div>
            <span style="color: red;" v-if="err">输入内容格式有误!</span>
            <template #footer v-if="type > 2">
                <span slot="footer" class="dialog-footer">
                    <el-button @click="state = false" size="small">取 消</el-button>
                    <el-button type="primary" @click="onOk" size="small">确 定</el-button>
                </span>
            </template>
        </el-dialog>
        <ConfigPanel :menus="menus" @change="panelChange"></ConfigPanel>
    </div>
</template>

<script>
import jsonlint from 'jsonlint-mod';
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/lint/lint.css';
import CodeMirror from 'codemirror/lib/codemirror';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/json-lint';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/vue/vue';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/css/css';
import 'codemirror/addon/mode/overlay';
import 'codemirror/addon/mode/simple';
import 'codemirror/addon/selection/selection-pointer';
import 'codemirror/mode/handlebars/handlebars';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/mode/pug/pug';

import is from '@form-create/utils/lib/type';
import formCreate from '@form-create/element-ui';
import ZhCn from "../src/locale/zh-cn";
import En from "../src/locale/en";
import arrowDown from "@element-plus/icons-vue/dist/es/arrow-down.mjs";
import {copyTextToClipboard} from "../src/utils";
import ConfigPanel from "./components/ConfigPanel.vue";

// Simple translation helper
const translations = {
    cn: {
        'language.import': '导入',
        'language.export': '导出',
        'language.exportPreviewUrl': '导出预览 URL'
    },
    en: {
        'language.import': 'Import',
        'language.export': 'Export',
        'language.exportPreviewUrl': 'Export Preview URL'
    }
};

const CACHE_KEY = 'fc-config-$101';
const TITLE = ['生成规则', '表单规则', '生成组件', '设置生成规则', '设置表单规则'];

export default {
    name: 'app',
    components: {
        ConfigPanel,
        arrowDown,
    },
    data() {
        let data = window.location.hash.substring(1);
        let hashData = null;
        if (data) {
            try {
                hashData = JSON.parse(decodeURIComponent(escape(atob(data))));
            } catch (e) {
            }
        }
        return {
            state: false,
            value: null,
            title: TITLE,
            editor: null,
            err: false,
            type: -1,
            autoSaveId: null,
            lang: 'cn',
            locale: null,
            menus: [],
            hashData,
            config: {
                autoActive: true,
                fieldReadonly: false,
                showSaveBtn: true,
            },
            handle: [
                {
                    label: '中英切换',
                    handle: () => {
                        this.changeLocale();
                    },
                },
            ],
        };
    },
    watch: {
        state(n) {
            if (!n) {
                this.value = null;
                this.err = false;
            }
        },
        value() {
            this.load();
        }
    },
    methods: {
        t(key) {
            const lang = this.lang || 'cn';
            return translations[lang]?.[key] || key;
        },
        panelChange(config) {
            if (config.locale === 'en') {
                this.locale = En;
                this.lang = 'en';
            } else {
                this.locale = ZhCn;
                this.lang = 'cn';
            }
            this.config = {...this.config, ...config};
        },
        getCache() {
            function def() {
                return {opt: null, rule: null};
            }

            try {
                let cache = localStorage.getItem(CACHE_KEY);
                if (!cache) {
                    return def();
                }
                cache = JSON.parse(cache);
                cache.rule = formCreate.parseJson(cache.rule);
                return cache;
            } catch (e) {
                return def();
            }
        },
        setCache({opt, rule}) {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                opt,
                rule: formCreate.toJson(rule)
            }));
        },
        loadAutoSave() {
            const s = this.autosave;
            if (s === false) return;
            this.autoSaveId = setInterval(() => {
                if (this.$refs.designer) {
                    this.setCache({opt: this.$refs.designer.getOption(), rule: this.$refs.designer.getRule()});
                } else {
                    this.autoSaveId && clearInterval(this.autoSaveId);
                    this.autoSaveId = null;
                }
            }, is.Number(s) ? s : 2000);
        },
        changeLocale() {
            if (this.lang === 'cn') {
                this.locale = En;
                this.lang = 'en';
            } else {
                this.locale = ZhCn;
                this.lang = 'cn';
            }
        },
        load() {
            let val;
            if (this.type === 2) {
                val = this.value;
            } else if (this.type === 0) {
                val = formCreate.toJson(this.value, 2);
            } else {
                val = JSON.stringify(this.value, null, 2);
            }
            this.$nextTick(() => {
                this.editor = CodeMirror(this.$refs.editor, {
                    lineNumbers: true,
                    mode: this.type === 2 ? {name: 'vue'} : 'application/json',
                    gutters: ['CodeMirror-lint-markers'],
                    lint: true,
                    line: true,
                    tabSize: 2,
                    lineWrapping: true,
                    value: val || ''
                });
                this.editor.on('blur', () => {
                    this.err = this.editor.state.lint.marked.length > 0;
                });
            });
        },
        onValidationError(e) {
            this.err = e.length !== 0;
        },
        showJson() {
            this.state = true;
            this.type = 0;
            this.value = this.$refs.designer.getRule();
        },
        showOption() {
            this.state = true;
            this.type = 1;
            this.value = this.$refs.designer.getOption();
        },
        showTemplate() {
            this.state = true;
            this.type = 2;
            this.value = this.makeTemplate();
        },
        setJson() {
            this.state = true;
            this.type = 3;
            this.value = [];
        },
        setOption() {
            this.state = true;
            this.type = 4;
            this.value = {form: {}};
        },
        copyUrl() {
            const rule = this.$refs.designer.getJson();
            const options = this.$refs.designer.getOptionsJson();
            const str = btoa(unescape(encodeURIComponent(JSON.stringify({rule, options}))));
            copyTextToClipboard('https://form-create.com/v3/designer#' + str);
        },
        onOk() {
            if (this.err) return;
            const json = this.editor.getValue();
            let val = JSON.parse(json);
            if (this.type === 3) {
                if (!Array.isArray(val)) {
                    this.err = true;
                    return;
                }
                this.$refs.designer.setRule(formCreate.parseJson(json));
            } else {
                if (!is.Object(val) || !val.form) {
                    this.err = true;
                    return;
                }
                this.$refs.designer.setOption(val);
            }
            this.state = false;
        },
        makeTemplate() {
            const rule = this.$refs.designer.getRule();
            const opt = this.$refs.designer.getOption();
            return `<template>
  <form-create
    v-model="fapi"
    :rule="rule"
    :option="option"
    @submit="onSubmit"
  ></form-create>
</template>

<script>
import formCreate from "@form-create/element-ui";

export default {
  data () {
    return {
        fapi: null,
        rule: formCreate.parseJson('${formCreate.toJson(rule).replaceAll('\\', '\\\\')}'),
        option: formCreate.parseJson('${JSON.stringify(opt)}')
    }
  },
  methods: {
    onSubmit (formData) {
      //todo 提交表单
    }
  }
}
<\/script>`;
        }
    },
    mounted() {
        if (this.hashData && this.hashData.rule) {
            this.$refs.designer.setRule(this.hashData.rule);
            if (this.hashData.options) {
                this.$refs.designer.setOptions(this.hashData.options);
            }
        } else {
            // const cache = this.getCache();
            // if (cache.rule) {
            //     this.$refs.designer.setRule(cache.rule);
            // }
            // if (cache.opt) {
            //     this.$refs.designer.setOption(cache.opt);
            // }
            this.$refs.designer.setRule([]);
            this.$refs.designer.setOption({
                language: {
                    "zh-cn": {
                        "L_NONACC": '停息指示',
                        "TEXT151": '"Advised Through" Bank',
                        "L_NEW_BVCD": 'NEW_BVCD',
                        "L_TAX_RATE_1": '税率',
                        "TEXT157": '72Z Sender to Receiver Information',
                        "BBR": '归属机构',
                        "YEAR": '年份',
                        "DISHONR": '拒付',
                        "L_SETTL_DT": 'SETTLE.Date',
                        "L_CON_CITY": '通讯城市',
                        "L_CAL_SRC_1": '算费方法',
                        "L_LC_TYP_1": '备用信用证类型',
                        "L_PAID_EXP_DT": '已付存仓费到期日',
                        "L_BORROW": '关联的借贷人',
                        "L_BENNET_1": '发放受益人净额',
                        "BCH": '新核算单元',
                        "L_SEC_LNM": 'めセ粂ē嘿',
                        "L_O_PAY_SUSAC": 'Our Pay Suspense AC',
                        "L_LC_AMD_DT": '主信用证修改日期',
                        "L_EXT_APP": '应用',
                        "L_PLACE": '贷款投向地（HKMA）',
                        "TEXT171": '利率浮动周期单位',
                        "MNAME": '葡文名称',
                        "RL_CCY": '滚续货币',
                        "L_PAGE_NUM_7": 'Deposit NO.',
                        "L_PAGE_NUM_6": 'PAGE_NUM',
                        "L_CTY_REG_1": '国籍',
                        "L_PAGE_NUM_5": '2???',
                        "A": '新增一项',
                        "L_CTY_REG_2": '办公电话',
                        "L_PAGE_NUM_4": '²ꑯҳë',
                        "L_CTY_REG_3": '注册国家',
                        "L_PAGE_NUM_3": '查询页码',
                        "TEXT139": 'Reimbursing Bank',
                        "L_PAGE_NUM_2": '查询页码',
                        "D": '删除该项',
                        "L_PAGE_NUM_1": 'PAGE-NUM',
                        "TEXT130": '货币* - 全货币',
                        "CASH_TYP1": 'ZZ',
                        "M": 'M',
                        "L_SECTOR_CODE": '机构分类代码',
                        "WS_L_CRT_BR": '设置机构',
                        "L_AGENT_FLG": '代办人',
                        "BENE_CCY": '受益人帐号币种',
                        "L_CON_CNAME": '联系人本地名称',
                        "L_E_OUR_REF": '我方业务编号',
                        "L_FIRST_Q_2": 'First Queue',
                        "L_FIRST_Q_1": '起始队列',
                        "TEXT149": '分层金额',
                        "L_EDIT35_1": '货币代码36',
                        "B_EARLY": 'Early Redemption',
                        "L_CICSLEN": '输出记录条数',
                        "L_OT_M_FLG9": '付出纸硬币标识',
                        "L_CRDAMT": '实际配钞现金金额',
                        "L_FNAME": '托管机构名称',
                        "TEXT145": '78  Instructions To The Paying/Accepting/Negotiating Bank',
                        "L_INT_TAX_1": '利息税',
                        "GPNAME7_2": '客户忠诚度优惠信息',
                        "GPNAME7_1": '客户忠诚度礼券信息',
                        "L_ITMNM2": '汇兑损益内部户名称',
                        "L_CIA_NM_1": '账户本地名称',
                        "L_EDIT133_202": '报文用户参考编号',
                        "RATE_TYP_1": 'RATE_TYP',
                        "L_QUEUE_CODE": '队列代码',
                        "HFX_SELL": '汇卖总行转移价',
                        "SUP_OUT_LIST": '非清单内供应商',
                        "LEND_CHECK_TLR": '借出核准人',
                        "FIXED_AMT": '资助额',
                        "L_MAX9": '期限上限',
                        "DELV_BCH1": '留存部门1',
                        "L_CITY_CD_11": '借款人所属城市代码',
                        "DELV_BCH2": '留存部门2',
                        "L_CITY_CD_10": '客户城市代码',
                        "L_CITY_CD_13": '借款人城市代码',
                        "L_CITY_CD_12": 'Customer City Code ',
                        "L_PRO_LIA_1": '利润率',
                        "COUNTRY": '国家/地区',
                        "L_RP_PERD2": 'RP Frequency',
                        "REGFLG": '报送监管标识',
                        "L_MAXI": '39B 信用证金额最高限额',
                        "CLIB_IN_AMT": '入账金额',
                        "PAY_NO": '付款编号',
                        "L_GL_MSTNO_1": '科目组编号',
                        "CTA_NO2": '新合约号',
                        "L_GL_MSTNO_2": '主科目号2',
                        "L_GL_MSTNO_3": 'GL Master No.(Br)',
                        "STUM": '短期当月累计额度使用率',
                        "SUB_BY_BATCH": 'SUBMIT BY BATCH',
                        "L_CHG_MOD": '收费模式',
                        "L_LOCAL_BK_NO": 'Local_Bk_No',
                        "FROM_AREA": '数据来源',
                        "L_OLD_INSTR_AMT": '指示金额 33B',
                        "L_AMT_PT16": '16-20',
                        "L_ERPBR_NO_1": '报ERP分行号',
                        "PARTICIPANTRELATIONSHIPTYPE": '关系类别',
                        "L_GL4_1": '主科目号（预留）',
                        "DELV_BCH5": '留存部门 5',
                        "L_RANAME1": '57A 收款方代理姓名',
                        "DELV_BCH3": '留存部门3',
                        "L_IN_D_AMT": '应收金额',
                        "DELV_BCH4": '留存部门4',
                        "L_SEC_TERM": '债券期限',
                        "CLBI_GD_NUM": '完整券张数',
                        "OIC_NAME": '客户经理名称',
                        "L_AMT_PT11": '11-15',
                        "L_E_THR_AC": '他方账号',
                        "BHC": '银行所属国家',
                        "CIREL_CD": '代办人关系',
                        "L_TAX_FLG": '收税标志',
                        "L_REMAINDER": 'Cash Remainder',
                        "L_PARTIAL_IND": '部分交收标志',
                        "L_EDIT3_4": '[3]',
                        "BTN_SEL_CINO1": '获取合约号码',
                        "L_EDIT3_3": '最后修改日期',
                        "L_EDIT3_2": '货币代码4',
                        "L_EDIT3_1": '核算单元4',
                        "L_EDIT3_8": 'HKMA',
                        "L_EDIT3_5": '协议类型',
                        "NOSAC_CD": 'NOSAC_CD',
                        "INSR_CCY": '保险货币',
                        "L_VOUCHERDATE": '凭证日期',
                        "L_EDIT3_9": '原交易票参考号',
                        "L_BUY_FLG_1": '买入钞汇标识',
                        "L_L_AC_NAME_TO": '内部户名称',
                        "L_BFC_RAT": 'Break Funding Rate',
                        "RP_G_RE_REFUND_IND": '请求退汇标志',
                        "L_EDIT22_1": '货币代码23',
                        "BIA": '受益行账号',
                        "L_REVCT_UP": 'Revocation Update',
                        "L_FXSELL_SP5": '现汇卖出幅度',
                        "L_PRDT_NAME": '可售产品名称',
                        "STUY": '短期当年累计额度使用率',
                        "USE_PLC": '使用所在地',
                        "L_INT_DDAC": '利息转存到活期账户',
                        "BIN": '卡BIN码',
                        "STUT": '短期当天额度使用率',
                        "L_CHN_ADDRESS2": '非标准化中文地址2',
                        "L_CHN_ADDRESS1": '非标准化中文地址',
                        "L_CITY_CD_20": '客户所属城市代码',
                        "L_CD_1": '待处理业务类型',
                        "L_CITY_CD_22": '客户城市',
                        "L_CITY_CD_21": 'City Code',
                        "L_CITY_CD_23": '发行城市',
                        "L_CITY_CD_15": '参与行所在城市代码',
                        "L_DEF_PAY_DET1": '议付/延期付款条款(42P)',
                        "L_CITY_CD_14": '客戶城市代碼',
                        "L_CITY_CD_17": '客户城市代码 ',
                        "LABEL11": '7.未提供通讯地址或住址，要求“hold mail(保存邮件)”，本行暂不提供该项服务。',
                        "L_CITY_CD_16": '借款人所在城市',
                        "LABEL10": '**********************************************************************详细信息*****************************************************************************',
                        "ACTION": '处理类型',
                        "L_CITY_CD_19": '客户所在城市',
                        "L_NET_AMT_1": '债券产品净面额',
                        "L_MAKETVALUE": 'Market Value ',
                        "L_BATNO": '批次号',
                        "AC_INT": '计提利息',
                        "L_CITY_CD_18": '借款人城市代码 ',
                        "TEXT192": '零整供款计划信息',
                        "TEXT193": '整零支取计划信息',
                        "DESC_60_2": '卡产品名称',
                        "L_NET_AMT_2": 'Net Amount',
                        "L_BAL_IND": '科目余额标志',
                        "L_AF_MT103_SND_CHG": '发报行费用',
                        "T_HELP": '[ A-Add;  M-Modify; D-Delete; I-Inquire]',
                        "L_DES_FLG": '调剂类型',
                        "L_MT752_FLG3": '净金额(33a)',
                        "L_DUP_FLAG": '重用标志',
                        "INQ_BASIC": '信用证基本信息查询',
                        "TEXT_BZ_REGI5": '是，客户曾被报送过可疑交易，经查询近六个月交易未发现异常情况，不建议报送可疑报告。',
                        "L_CAPT_FLG": '本金化标志',
                        "L_DESC_2": '摘要',
                        "TEXT14_2": '交换日转换规则',
                        "EXSTM_CD3": '结售汇统计代码3',
                        "TEXT_BZ_REGI2": '否，经查询客户过往交易存在异常情形经分析无法排除可疑，将按内部流程报送可疑交易报告。',
                        "L_DESC_1": '描述',
                        "TEXT14_1": '市场买入价',
                        "L_IRAT_CD_1": '同业借出利率代码',
                        "TEXT_BZ_REGI3": '经查询，客户近六个月无自主交易的情况。',
                        "L_IRAT_CD_2": '同业拆入利率代码',
                        "TEXT14_4": '客户号码2',
                        "EXSTM_CD1": '结售汇统计代码1',
                        "L_IRAT_CD_3": 'FTP利率代码',
                        "TEXT14_3": 'Msg Type',
                        "L_CCY5_2": '货币05',
                        "EXSTM_CD2": '结售汇统计代码2',
                        "L_CCY5_1": '货币5',
                        "L_IRAT_CD_4": '基准利率参考代码',
                        "TEXT14_6": '容器同类型序号',
                        "TEXT14_5": '计息周期  （D-日/W-周/M-月/Q-季/H-半年/Y-年/N-不过息）',
                        "L_OLINENO": '原打印行数',
                        "L_IRAT_CD_5": '缺省利率代码',
                        "L_DESC_8": '规则描述',
                        "L_NEW_PROD_TYP": '展望后到期日',
                        "L_CMP_ADRL_5": '当地语言地址',
                        "TEXT14_8": '转入凭证代码',
                        "L_IRAT_CD_6": 'Rate ID',
                        "L_DESC_7": '描述(英文)',
                        "TEXT14_7": '来源容器编号(5)',
                        "IB_AC_1": '借方同业往来账号',
                        "L_DESC_9": '描述',
                        "L_AMT_5_1": '持有息',
                        "IB_AC_2": '我方同业',
                        "L_NREV_PD60_AMT": 'Amount Past Due>60 Days for Non-Revolving',
                        "TEXT14_9": '50  申请人',
                        "L_DESC_4": '代理人信息',
                        "IB_AC_3": '我方账号',
                        "L_CMP_ADRL_1": 'ACCOUNT WITH BANK',
                        "L_DESC_3": '备注',
                        "L_DESC_6": '费率描述 ',
                        "L_DESC_5": '费率描述',
                        "L_INV_PROD_RISK_ASS_FLG": '投资产品风险评估',
                        "L_STC_FLG": '静态标志',
                        "TRN_CODE": '交易业务码',
                        "L_E_RBTSCM": 'Rebate Scheme',
                        "PBCD_KND": '公共代码类型',
                        "UOD_LMT": '过额透支限额',
                        "L_ZPK": 'ZPK',
                        "L_AMT_XCN": '当旬贷方笔数',
                        "L_CDPP": '核算机构缩写代码',
                        "BTN_CARD": '借记卡信息',
                        "L_CHG_MTH": '收费方式',
                        "L_LC_AMD_NO": '信用证修改次数',
                        "L_PARM_COD": '基础产品代码',
                        "L_NOT_PRINT_NIL_ACT_1": '不打印空白结单标志',
                        "L_CUT_FLG": '是否允许冲回标识',
                        "L_PAY_NOSTRO": 'Our Pay Nostro',
                        "L_CLS_PAR": '转账摘要',
                        "L_SIGNRETTRSEQNO": '协议号',
                        "DEF_VAL": '默认值',
                        "L_NLAST_DT_SHIP_1": '新最迟装运期(44C)',
                        "L_REC_NOS": '穨姐め',
                        "TABPAGE3_1": '帐/客户状态',
                        "DRCRFLG": '借、贷方标志',
                        "L_LEGSTS": '法人地位',
                        "L_LGL_IDTYPE": '法人证件类型',
                        "USAGE": '物业用途',
                        "L_ADVTHU": '通知方式',
                        "L_AMT_XDN": '当旬借方笔数',
                        "L_INIT_AMT": '存货初始帐面金额',
                        "BD_NUM": '当前全价残损张数',
                        "HOLDER_RECNO": '户主客户号',
                        "L_SPRD_AM2_1": '金额1',
                        "L_ID_NO_AGENT": '代办人证件号码',
                        "L_APT_CHNL": '预约渠道',
                        "L_EDIT133_202_1": '报文用户参考编号 ',
                        "L_STAT": '现金所处标志',
                        "OD_TOT": '透支积数',
                        "L_SPRD_AM2_2": '金额2',
                        "PARM_NM": '基础产品名称',
                        "L_SPRD_AM2_3": '金额3',
                        "LEND_REMARK": '借出摘要',
                        "L_TLCAMDNO": '转让信用证修改次数',
                        "THOR_FLG": '你是否提供阶段性担保',
                        "AC_BV_NO": '账号凭证号码',
                        "REFCCY": '参考币种',
                        "L_DRCINO": '借方客户号',
                        "BNK": 'BK',
                        "PAYMENT_INF": '入账信息',
                        "MANUAL_FLG": '手工标志',
                        "FLDNM": '栏位名称',
                        "L_NOTIONAL": 'Notional Incentive',
                        "L_DETAIL1": '通知书信息',
                        "L_CERT_TYP": '凭证类型',
                        "L_MSG_CODE": '信息码',
                        "L_LMT_NO_1": '本地行业额度编号',
                        "JOIN_FLG_1": '联名户',
                        "L_LMT_NO_2": 'Limit NO.',
                        "L_S1_1": '39A  信用证金额允许浮动范围',
                        "L_LMT_NO_5": '额度关联编号',
                        "L_S1_2": '39A  信用证金额浮动允许范围',
                        "L_LMT_NO_3": '额度编号',
                        "L_LMT_NO_4": '涂仅晤疡ㄩ',
                        "L_LMT_NO_9": '原额度编号',
                        "L_SETAC1_3": '结算账号1',
                        "L_LMT_NO_7": '风险额度编号',
                        "L_LMT_NO_8": '风险额度编号',
                        "L_SETAC1_1": '结算账号(1)',
                        "L_BV_NUM": '汇入业务编号',
                        "L_SETAC1_2": '结算账户(1)',
                        "L_TENOR_DT": '汇票到期日',
                        "L_AVA_AMT_1": '可用额度余额净值',
                        "L_SELLAMOUNT": 'Bank Sell Amount ',
                        "L_AVA_AMT_2": '可借款金额',
                        "L_AVA_AMT_3": '有效金额',
                        "L_TYPEA": '付息周期',
                        "CASH_NO": '现金分析号',
                        "L_SGCNO_1": '印鉴卡编号',
                        "L_I_PROLNO": '合同号码',
                        "L_IN_FLAG": '收入标志',
                        "L_BAMOUNT": '买入金额',
                        "L_PRINARR": '拖欠本金',
                        "L_OSPL_INT": '打包放款应计利息',
                        "L_LMT_CODE": '额度种类/产品代码',
                        "L_SGCNO_2": '印鉴卡号',
                        "TEXT27_3": '----------------------------------------------',
                        "L_TOT_CRAMT": '已调整的贷记金额',
                        "TEXT27_1": 'Text27',
                        "TEXT27_2": 'SHIP.FM',
                        "L_TYPE2": '原设置状态',
                        "L_TYPE1": '七个维度的产品分类 '
                    },
                    "en": {
                        "L_DIGIT_1": '1',
                        "L_DIGIT_2": '2',
                        "L_DIGIT_3": '3',
                        "L_DIGIT_4": '4',
                        "L_DIGIT_5": '5',
                        "L_DIGIT_6": '6',
                        "L_DIGIT_7": '7',
                        "L_DIGIT_8": '8',
                        "L_DIGIT_9": '9',
                        "L_DIGIT_10": '10',
                        "L_DIGIT_11": '11',
                        "L_DIGIT_12": '12',
                        "L_DIGIT_13": '13',
                        "L_DIGIT_14": '14',
                        "L_DIGIT_15": '15',
                        "L_DIGIT_16": '16',
                        "L_DIGIT_17": '17',
                        "L_DIGIT_18": '18',
                        "L_DIGIT_19": '19',
                        "L_DIGIT_20": '20',
                        "L_DIGIT_21": '21',
                        "L_DIGIT_22": '22',
                        "L_DIGIT_23": '23',
                        "L_DIGIT_24": '24',
                        "L_DIGIT_25": '25',
                        "L_DIGIT_26": '26',
                        "L_DIGIT_27": '27',
                        "L_DIGIT_28": '28',
                        "L_DIGIT_29": '29',
                        "L_DIGIT_30": '30',
                        "L_DIGIT_31": '31',
                        "L_DIGIT_32": '32',
                        "L_DIGIT_33": '33',
                        "L_DIGIT_34": '34',
                        "L_DIGIT_35": '35',
                        "L_DIGIT_36": '36',
                        "L_DIGIT_37": '37',
                        "L_DIGIT_38": '38',
                        "L_DIGIT_39": '39',
                        "L_DIGIT_40": '40',
                        "L_DIGIT_41": '41',
                        "L_DIGIT_42": '42',
                        "L_DIGIT_43": '43',
                        "L_DIGIT_44": '44',
                        "L_DIGIT_45": '45',
                        "L_DIGIT_46": '46',
                        "L_DIGIT_47": '47',
                        "L_DIGIT_48": '48',
                        "L_DIGIT_49": '49',
                        "L_DIGIT_50": '50',
                        "L_DIGIT_51": '51',
                        "L_DIGIT_52": '52',
                        "L_DIGIT_53": '53',
                        "L_DIGIT_54": '54',
                        "L_DIGIT_55": '55',
                        "L_DIGIT_56": '56',
                        "L_DIGIT_57": '57',
                        "L_DIGIT_58": '58',
                        "L_DIGIT_59": '59',
                        "L_DIGIT_60": '60',
                        "L_DIGIT_61": '61',
                        "L_DIGIT_62": '62',
                        "L_DIGIT_63": '63',
                        "L_DIGIT_64": '64',
                        "L_DIGIT_65": '65',
                        "L_DIGIT_66": '66',
                        "L_DIGIT_67": '67',
                        "L_DIGIT_68": '68',
                        "L_DIGIT_69": '69',
                        "L_DIGIT_70": '70',
                        "L_DIGIT_71": '71',
                        "L_DIGIT_72": '72',
                        "L_DIGIT_73": '73',
                        "L_DIGIT_74": '74',
                        "L_DIGIT_75": '75',
                        "L_DIGIT_76": '76',
                        "L_DIGIT_77": '77',
                        "L_DIGIT_78": '78',
                        "L_DIGIT_79": '79',
                        "L_DIGIT_80": '80',
                        "L_DIGIT_81": '81',
                        "L_DIGIT_82": '82',
                        "L_DIGIT_83": '83',
                        "L_DIGIT_84": '84',
                        "L_DIGIT_85": '85',
                        "L_DIGIT_86": '86',
                        "L_DIGIT_87": '87',
                        "L_DIGIT_88": '88',
                        "L_DIGIT_89": '89',
                        "L_DIGIT_90": '90',
                        "L_DIGIT_91": '91',
                        "L_DIGIT_92": '92',
                        "L_DIGIT_93": '93',
                        "L_DIGIT_94": '94',
                        "L_DIGIT_95": '95',
                        "L_DIGIT_96": '96',
                        "L_DIGIT_97": '97',
                        "L_DIGIT_98": '98',
                        "L_DIGIT_99": '99',
                        "L_ACC_CAP": 'Account Cap',
                        "TEXT26_3": '-',
                        "TEXT4_25": '--',
                        "L_BLANK": 'Blank',
                        "TEXT15_15": '-- Add A Item',
                        "TEXT6_26": '-- ADD A ITEM',
                        "TEXT22_5": '-- Del A Item',
                        "TEXT21_11": '-- DEL A ITEM',
                        "TEXT17_10": '-- Mod A Item',
                        "TEXT13_11": '-- MOD A ITEM',
                        "L_TD_AC_NO": ' Nostro Account NO.',
                        "TEXT151_1": '"Advise Through" Bank',
                        "TEXT151": '"Advised Through" Bank',
                        "TEXT73_2": '"Advised Through" Bank',
                        "TEXT1_33": '#Customer Default Address',
                        "TEXT1_26": '#Customer Default Address, Generally Used For Statement And Notice Mailing.',
                        "TEXT27_2": '$',
                        "L_PIN_BLOCK_ZPK": '%',
                        "L_TEXT8": '% Allowance (39A)',
                        "TEXT12_11": '% of Loan Outstanding Balance',
                        "TEXT85": '% Overdue more than 29 days',
                        "L_DUE_GT_89_DAYS": '% Overdue more than 89 days',
                        "L_PA_OFFSET": '% p.a for Off-Set',
                        "L_TEXT22": '%Allowance',
                        "BUTTON1_8": '&Get App Code',
                        "TEXT9_19": '( Y - Complete )',
                        "L_INTRFLAG": '(+/-)',
                        "TEXT10_14": '(1-Finance,2-Query,3-Maintenance)',
                        "TEXT9_25": '(1-Service,2-Unit,3-Integ,4-Logic,5-Resource)',
                        "L_DESC_30_7": '(C)Description',
                        "TEXT11_4": '(C/U)',
                        "TEXT3_14": '(D/W)',
                        "TEXT3_27": '(day)',
                        "L_ENDTM": '(Day)',
                        "L_ENGLISH": '(English)',
                        "TEXT29_3": '(For Notification)',
                        "L_LOCAL": '(Local)',
                        "L_NEW": '(New)',
                        "TEXT5_35": '(NO FEE IF NOT SELECT AN AC)',
                        "TEXT17_11": '(No Of Linked Shares(Equity Element))',
                        "L_OLD": '(Old)',
                        "TEXT2_1_1": '(Please Enter A Date Within 381 Days Before Or After Today)',
                        "TEXT3_1_1": '(Please Enter A Date Within 381 Days From The Start Date)',
                        "TEXT8_42": '(Please input this field if charge fees.)',
                        "TEXT16_5": '(Principal And Int Amt)',
                        "TEXT231": '(Range 0-20)',
                        "TEXT8_13": '(Space/R/C)',
                        "L_F_FATFLG_1": '(Such As US Listed Company, US Government)',
                        "L_F_FATFLG": '(Such as US listed company, US government)',
                        "TEXT4_21": '(Time)',
                        "L_USD": '(USD)',
                        "TEXT9_13": '(X/O/B)',
                        "TEXT22_2": '(Y/N)',
                        "L_LABEL11": '（1）.',
                        "TEXT8_44": '（EQU RECV AMT OR AFTER DEDUCT SWIFT FEE)',
                        "TEXT5_34": '（NO FEE IF NOT SELECT AN AC）',
                        "RMK_CRS2": '* No Need To Fill Out This Page For Corporate Customers!',
                        "TEXT704": '* Payment For Remit Amount (Or Include Charges) *',
                        "DIVIDE": '/',
                        "TEXT42_3": '/ -',
                        "TEXT46_1": '//',
                        "T_HELP": '[ A-Add; M-Modify; D-Delete; I-Inquire]',
                        "TEXT13_13": '[+/-]',
                        "TEXT2_36": '[320-MT320; 202-MT202; 210-MT210]',
                        "T_HELP_1": '[A-Add; D-Delete; I-Inquire]',
                        "T_OPTHELP": '[A-Add; M-Modify; D-Delete; I-Inquire]',
                        "TEXT58_3": '[A-APPROVE]',
                        "TEXT9_20": '[C-CREATE; U-UPDATE; D-DELETE]',
                        "TEXT8_25": '[C-CREATE; U-UPDATE; D-DELETE]',
                        "TEXT3_28": '[CHT-CHATS OUT; MAT-CHATS IN MATCHING DATA]',
                        "TEXT14_9": '[F/P]',
                        "TEXT13_15": '[G/O]',
                        "TEXT20_16": '[H-Hold; R-Release]',
                        "TEXT18_9": '[J/I/O]',
                        "TEXT4_22": '[N/T/M/H]',
                        "TEXT4_42": '[N-NEW C-CHG D-DEL I-INQ]',
                        "TEXT4_45": '[N-NEW; C-CHG; D-DEL; I-INQ]',
                        "TEXT4_44": '[N-NEW; C-CHG; D-DEL; I-INQ]',
                        "TEXT4_43": '[N-NEW; C-CHG; I-INQ; D-DEL]',
                        "TEXT6_21": '[PLACE]',
                        "TEXT4_23": '[R-RECEIVE; P-PAYMENT; B-BOTH]',
                        "TEXT37_4": '[S-Simple Line, I-INT To Yield]',
                        "TEXT2_35": '[TAKE]',
                        "TEXT6_23": '[Y/N/B-BOTH]',
                        "TEXT32_7": '[Y/N]',
                        "L_DELIVRY_DT": '[Y:DELIVERY DATE < T-7, N:DELIVERY DATE >=T-7]',
                        "TEXT6_22": '[Y-YES;N-NO]',
                        "BUTTON51_1": '~BACK',
                        "L_DOC_DEFINE3": '+',
                        "TEXT91": '+/-',
                        "TEXT2_44": '0 - PENDING FOR INDICATION',
                        "L_CALLTERM_1": '001 Description of Goods And/Or Services',
                        "TEXT2_12": '01－Whole Day Typhoon，02－Half Day Typhoon',
                        "TEXT10_4": '01-04',
                        "L_AMT_PT1": '01-05',
                        "L_EVEN_CD_1_1": '01-06',
                        "TEXT11": '05-08',
                        "L_AMT_PT6": '06-10',
                        "L_EVEN_CD_7": '07-12',
                        "TEXT12_3": '09-12',
                        "T_OPT": '1 - Libor Rate; 2 - Hibor Rate; 3 - Prime Rate; 4 - Exchange Rate; 9 - All Above',
                        "TEXT3_32": '1 - PRIN ROLLOVER WITH INT TO DD AC',
                        "L_FST_AMT": '1 ST Bene Bill Amount',
                        "L_ADDR_2_1": '1. Source Of Wealth',
                        "L_ADDR_2": '1. Source of Wealth',
                        "L_ADDR_21_1": '10.Customers Engage In Registered Currency Exchange And Remittance Agents, Etc.',
                        "CARD1_2": '1-10',
                        "L_AMT_PT11": '11-15',
                        "CARD2": '11-20',
                        "L_TEXT17_1": '12.High-Risk Customers',
                        "TEXT13_2": '13-16',
                        "L_EVEN_CD_13": '13-18',
                        "UCH_TABS1": '1-5',
                        "L_AMT_PT16": '16-20',
                        "TEXT14": '17-20',
                        "L_EVEN_CD_19": '19-24',
                        "L_FRAC1": '1st',
                        "L_FISRT_DATE": '1st Amortize Date',
                        "L_TLR_NO_5_1": '1ST CFM',
                        "L_DAYS_9": '1ST INT.Rank',
                        "TEXT9_32": '1st Mail',
                        "L_FIRST_MATCH_DATE": '1st Match Date',
                        "L_FRAC10": '1th',
                        "L_LMT_NO_14": '1TM LMT. NO.',
                        "TEXT4_26": '2 - PRIN PLUS INT ROLLOVER',
                        "L_ADDR_6_1": '2. Source Of Funds',
                        "L_ADDR_6": '2. Source of Funds',
                        "L_LCNO_4": '20 Documentary Credit Number',
                        "L_LCNO_1": '20 Documentary Credit Number',
                        "L_BILL_NO1_1": '20 Documentary Credit Number',
                        "MT192_TRX_REF": '20 Trans Reference',
                        "TEXT48_2": '20 Transaction Reference NO.',
                        "L_REF_NO1": '20 Transaction Reference NO.',
                        "L_REFNO_1": '20 Transaction Reference NO.',
                        "L_LCNO_3": '21 Documentary Credit Number',
                        "TEXT51_4": '21 Number of The Issuing Bank',
                        "TEXT5_29": '21 Receiver S Reference',
                        "L_MT707_21_1": '21 Receiver’s Reference',
                        "L_REF_NO_2_1": '21 Reimbursing Bank’s Reference',
                        "TEXT51_3": '21 Related Business Numbers',
                        "L_REL_REF_300": '21 Related Ref',
                        "L_RLT_REF": '21 Related Reference',
                        "L_REL_REF_202_2": '21 Related Reference',
                        "L_REF_NO_2_2": '21 RELATED REFERENCE',
                        "MT192_ORG_REF": '21 Related Reference',
                        "L_RELATEDREF": '21 Related Reference NO.',
                        "L_REF_NO_18": '21 Related Reference NO.',
                        "L_OPER_TYPE_300": '22A Operation Type',
                        "L_MT707_22A": '22A Purpose of Message',
                        "L_COM_REF_300": '22C Common Ref',
                        "TEXT54_12": '23 FURTHER IDENTIFICATION',
                        "L_MT707_23": '23 Issuing Bank’s Reference',
                        "L_MT707_23_1": '23 Issuing Bank’s Reference',
                        "L_PRE_REFNO": '23 Reference to Pre-Advice',
                        "L_MT707_23S_1": '23S Cancellation Request',
                        "L_MT707_23S": '23S Revocation Request',
                        "L_ACC_NO": '25 Account Identification',
                        "L_EVEN_CD_25": '25-30',
                        "L_MT707_26E": '26E Modify The Serial Number',
                        "TEXT16_7": '26E Number of Amendment',
                        "L_MT707_26E_1": '26E Number of Amendment',
                        "L_MT707_27": '27 Sequence of Total',
                        "L_PAGESEQ": '27 Sequence of Total',
                        "TEXT8_46": '27 Sequence of Total',
                        "L_FRAC2": '2nd',
                        "L_SEC_AMT": '2nd Bene Bill Amount',
                        "L_SECBENCHG": '2nd Benef Bk Charges',
                        "L_SEC_BBCH": '2nd Benef Bk Chg',
                        "L_TT_CHGS_1": '2nd Benef Bk SWIFT Chg',
                        "L_SECBNM_X1": '2nd Benef Code/Name/Add',
                        "L_SECBENBK_REF": '2nd Benef Ctr Party Ref',
                        "L_SECBK_CINO": '2nd Benef Ctr Party/Name/Add',
                        "L_SECBKSWF": '2nd Benef Swift Code',
                        "L_ISS_CINO_2": '2nd Beneficiary Bank',
                        "L_TLR_NO_6_1": '2ND CFM',
                        "L_DAYS_2_1": '2ND INT. Rank',
                        "L_DAYS_2_2": '2ND INT.Rank',
                        "TEXT16_9": '2nd Mail',
                        "TEXT10_16": '2nd Mail',
                        "TEXT5_25": '3 - PRIN PLUS INT + AMOUNT ROLLOVER',
                        "TEXT57_5": '30 DATE OF ADVICE OF DISCREPANCY OR MAILING',
                        "L_MT707_30": '30 Date of Amendment',
                        "TEXT13_14": '30 Date of Amendment',
                        "TEXT54_9": '30 Date of Confirmed Message',
                        "TEXT54_10": '30 DATE OF THE ORIGINAL AUTHORISATION TO REIMBURSE',
                        "L_MT_DATE": '30 Date of The Original Authorisation To Reimburse',
                        "L_TRADE_DT_300": '30T Trade Date',
                        "L_VALUE_DT_300": '30V Value Date',
                        "L_EVEN_CD_31": '31-36',
                        "TEXT10_15": '31C Date of Issue',
                        "L_ISSDATE": '31C Date of Issue',
                        "L_MT707_31D1": '31D Date and Place of Expiry',
                        "L_EXPDATE_2": '31D Date And Place of Expiry',
                        "L_MT_DATE_1": '31D Date And Place of Expiry',
                        "TEXT51_5": '31D DATE AND PLACE OF EXPIRY',
                        "TEXT25_8": '31E New Date of Expiry',
                        "TEXT57_4": '31E NEW DATE OF EXPIRY',
                        "L_MT_DATE_2": '31E New Date of Expiry',
                        "TEXT1_58": '32A',
                        "L_RMT_AMT_202": '32A Amount',
                        "L_VAL_DT32A": '32a Amount of Charges'
                    }
                }
            });
        }
        this.$nextTick(() => {
            this.loadAutoSave();
        });
        this.menus = this.$refs.designer.menuList;
    },
    beforeDestroy() {
        const id = this.autoSaveId;
        id && clearInterval(id);
    },
    beforeCreate() {
        window.jsonlint = jsonlint;
    }
};


</script>

<style>

:focus-visible {
    outline: 0 none;
}













.handle {
    display: flex;
    align-items: center;
    margin-right: 15px;
}

._fc-t-menu .el-dropdown, .handle .el-dropdown {
    cursor: pointer;
}

.handle .el-icon {
    margin-left: 0;
}

body {
    min-height: 100vh;
    padding: 0;
    margin: 0;
    display: flex !important;
    flex-direction: column !important;
    background-color: #f5f5f5;
}

#app {
    display: flex;
    flex-direction: column;
    flex: 1;
}


._fc-t-dialog .CodeMirror {
    height: 450px;
}

._fc-t-dialog .CodeMirror-line {
    line-height: 16px !important;
    font-size: 13px !important;
}

.CodeMirror-lint-tooltip {
    z-index: 2021 !important;
}

._fc-t-dialog .el-dialog__body {
    padding: 0px 20px;
}


._fc-zz {
    background-image: -webkit-linear-gradient(left, #cd7f32, #d81159 10%, #ffbc42 20%, #75d701 30%, #30a9de 40%, #d81159 60%, #ffbc42 70%, #75d701 80%, #30a9de 90%, #cd7f32);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    background-size: 200% 100%;
    -webkit-animation: flowlight 5s linear infinite;
    animation: flowlight 5s linear infinite;
    font-weight: 700;
}

@keyframes flowlight {
    0% {
        background-position: 0 0;
    }
    100% {
        background-position: -100% 0;
    }
}

@-webkit-keyframes flowlight {
    0% {
        background-position: 0 0;
    }
    100% {
        background-position: -100% 0;
    }
}

.pro-version {
    color: #cd7f32 !important;
    font-weight: 600;
}

._fd-view-box > .title {
    font-weight: 800;
    font-size: 30px;
    line-height: 56px;
    color: #333333;
    text-align: center;
}

._fd-view-box > .desc {
    text-align: center;
    font-size: 16px;
    line-height: 25px;
    color: #666666;
}

._fd-view-products {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    width: 100%;
    grid-gap: 10px;
    padding: 10px;
    z-index: 1901;
    position: relative;
    box-sizing: border-box;
}

._fd-view-product {
    font-size: 12px;
    font-weight: 400;
    color: rgb(153, 153, 153);
    margin-bottom: 12px;
    border: 1px solid rgb(207, 222, 243);
    border-radius: 4px;
    background: center center / cover no-repeat #f6faff30;
    box-shadow: rgba(3, 51, 123, 0.08) 0px 5px 15px 1px;
    padding: 14px;
    background-image: url(data:image/png;base64,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i637rg08Zm8DpNFsHX4WbY29Q4ZqooR3QI0jJMEjCQydgDWSEfNGsLRDhcjQLxEz4OIVCI2GM/T461FihmYRCZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZAACZDA/waB/wJtBVtyNP/YuwAAAABJRU5ErkJggg==);
    background-position: right;
    background-size: auto;
    cursor: pointer;
    transition: background-color ease .3s;
    opacity: 0.95;
    text-decoration: none;
}

._fd-view-product.vue2 {
    border-color: #CCF6D5;
    background: center center / cover no-repeat #e6fae630;
    background-image: url(data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAQ4AAAB8CAYAAACYLF7bAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFG2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4wLWMwMDAgNzkuZGFiYWNiYiwgMjAyMS8wNC8xNC0wMDozOTo0NCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIyLjQgKE1hY2ludG9zaCkiIHhtcDpDcmVhdGVEYXRlPSIyMDI0LTEyLTIzVDIxOjAwOjE4KzA4OjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyNC0xMi0yM1QyMToxNzowNSswODowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyNC0xMi0yM1QyMToxNzowNSswODowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpkMTEyOWQwYS1jMzEyLTQyYWUtYjg2OC0xZWM3NjJmZjQ4NTgiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6ZDExMjlkMGEtYzMxMi00MmFlLWI4NjgtMWVjNzYyZmY0ODU4IiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6ZDExMjlkMGEtYzMxMi00MmFlLWI4NjgtMWVjNzYyZmY0ODU4Ij4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDpkMTEyOWQwYS1jMzEyLTQyYWUtYjg2OC0xZWM3NjJmZjQ4NTgiIHN0RXZ0OndoZW49IjIwMjQtMTItMjNUMjE6MDA6MTgrMDg6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyMi40IChNYWNpbnRvc2gpIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgWZD5YAAAzMSURBVHic7d1PbBzXfQfw73szs39mdpdc/qcpiZFiWzEUo0Zg9FAf6gpCUqBBAujio29Fj0lzbmDknmtzTHnkRYf2koMgOAcHbdMGkR2liVwzpkVK4v8ld2d2Z+bNez1whyHt5e68JWUYxfcj8EByd3Z4mK9+vzfvvRHGGBDRYEII6/d8sPW+04r33cnylIyznumqyOoi66i2AICNcF0kOhEAkOpEBG5N7MU7QhsttNEiM5nQRgsAMDBnTtR3fUyXZxGpEADw6yf/XuizXd8571cagAIQ3bvzQEubP4iIhrt7/7YI047MTDZWaJw2VZ4BADRLUyc/q3sThd4bqQh78Q66WQTfDQp/pooyqCgb9CsJoARg4u792w6Dg+iS3L1/W7xz410ReDXRKE3Ii4RGpEIBHIfGdu+5SHUqEp2Iw+TgpMoYfYwIAFB1/GGVhC0BoCrYqhCdz6ZVWV1bcWcr827+/bgtCnAcHM+7T0WqEzFZmkKqE7HT25J5iwIA2mgRqo4AMLSqmC7PYLo8i9/u/xee7z8rdC4jgoatChFZk+7o1xDRKKtrK27NrTtKK+lKV1+kTckHRZulKSQ6wU5vS2RGDWxRioxf7MW7mC7PYqYyC0wBu73t88YxCmNwEF2CK8GybMX76GVd000i1Nz62Md6pfEaulkkASDOesIRDlKdiqfRk7GPuRGtAzgOmqrro4320NfnwXJey8LgILocTtX1DQDjCGfsaqPq+KLiVMVEabIfHLGoew2EqoOLBEekIviuj6vBMiIVjgyOURgcRBewurYim6VpZ693fOuz5tbHCo356qLzhv+m0/AmZc2rD/xvfqb8r+bjoz+YTzufXOicfTfAwtRioYFSFWUDqw4OjhKRNVYcRGO6e/+2aJamHQBeN4v0uNXGzYlbznx10a159aHX43eufE/M7M4BgAlVB1vdYrdWc5GKEKl1+K6PVxuv4Rf7/1bofYPGOxgcRGNYXVuRAORBsieqjm/GDQ0AcKVbeLJI4NYwV13Advc5AJxMKbeZHQoA3SxCvVFHV0Vj3WFhq0I0hivBsqi5dQeXcA05whE4npE5UtX1UZIlkRllv4jmc2Yr86i6/ljvZXAQWVpdW5Eb4brjyZIzW5mHIxz9ZZ+DI1wjhTSBWzOBW7OqdiIV4Um4jqvBMgK3NtZ0dAYHEVljcBDZKwG48AzR3Gfhp5mBKVS1GBgDQHvSO/O5kQpPxjuKilSIq8Ey3pp/GwtTiyNff3rlLIODqKC792+L1bUVma9cvYzQAIA46xlttAGQfw0UqdAcJYdmvfMn08t6xhGOkUKaUHUwTsuyF++im0Un3xdtWVSU8a4KUVHv3HhXAJC+GwgMucBtdVVk+pWEwZBB0kiFWGs/xnbvmTm9bqXuNUzRpfbnKToVPceKg6igg3jPwXGbMvacjUFuTtxyXOHmd2jy3b+SjXA9+UPrd2knbWcAMFOZE683v4VvTHwTV4OvGSmkcYRjQtVB/iUgxhoo9V0f35r+y8LvY3AQkTW2KkQjrK6tyIN4z3GlJ6uOf6FFbIN8vfFqCf1Ko5O2s6O0pT/c/00KHG/uE+vYWai+hPnqorPoL8m/vfJ98T+tj/Rm9JnRRouGN2EyczxoqY0W404KA4CFqcVCy+5ZcRCN8LuD30pXenKxuoRudjkDogBQdX3xcuPmSXsCwHRU23RV98xVu919bnZ72xn64yqBWxOTpSkxV1kUUkgDAHmYnZ7bISCMgDBF7rbke5TmYx1DGACGwUE0xN37t8WSf1XUvYbTUW1xmWMbS/5V4buBg1MDolXH15+Ffzpza9aVrj5MWxlwXEX4biAapQmxXLsugOOwAP4cHuOKVITp8gwCtzbytc577713kc8i+n9NCFGarcxLR7hCmRQlWb6U41ZdX7zkX/GWgmsl4LhFeRKup/vxbrbb2z4JgJIsQ+kUu/E2gOPHINS8uizLini5cVP+vvWh6mXd/Fwh+hkkhDj58qQHUfRf/xjNYEooJ0USJ2fOW6daqV6WsOIgImscHCUa4Vl3E3WvcaEVsKfdnLjlzFUXnLrXkAAQqVDvxTvZHw8fnTsi2V8Nq/5q7q8BQPbHIcSdl/7O+fXur8xa+/HJuU2UJg0AHCYtARy3MPnO6KNI4UAKCW00pJDAqfEXo40pTXgpgJjBQTTERrieXQmWnUiFEsBYO3wt+ksoybLwpCfa6ZGYqczJfmj0n9KWqjjrDZ1yfqP+iumotoizWLfTI9V/v7PoL4lrwXVMl2fNXrwj6l4D7fQIW92nJ2MfNiZLTez0tkSoOgjTTv5jYzKTeXVXAcju3XlgGBxEQ3yw9b7+9tJ3ZbM8PdZs0Tw0Kk5Vlp2yrHl14QhHAjiZ373VfZptRk8KHfv3rQ9NK9nPloJrYqH6EmYr8/KN6Tf1RrgulmvX0c26ohXvm5Ismc3+HqWHyYEoGiKBWxOBW8PTvc0zFUr/fm8KIAPYqhANde/OA/PWR2/rUHXURKkpIhXKucpCoQVpb0y/WRq2h2ikQgPA/O/RHwsdr1/tmE/aj0XFqeqGN6F9N5CzlXk5W5k/M16509vSz6JNs9b+WP9m7z8GHn+y1DzzfcWpilSniSOczPWd022Tufe9X54JHg6OEpE1PgKSaIj8EZB3798W3176rlt2Ku6oimO5dkNUnKr8euPVSpHPeHTwMEp0bJ5FmyNfmx+7yB6lAPC8+1T9584H2bNo49wLPdGJAICKUxF//40fdM573WlsVYgKONWyZL4byGGDpIdpS9S8euHVqtdq1z1ttLlRf3Xka6WQQkAIKWShbkFAiJnKnNiPdweGXZz1BADUvYbupO3CVQSDg6igD7be12/Nv41IhQ5w/h2WmfJsvo9oIXWv4V3WOX5e4NYwVZoeei4TpUkcJYfGk17hXYvZqhANMehp9T9//M9V3w0MMDg8Xm7clL4bOFeC5dKXcIpDddJ21kr2s19t/1J9/neRCkX+dwBQ79x49wuvOQ8HR4nIGlsVIku+G8Qb4bobuDUXAzb1CVVHpzo1RSuOT44e93pZV6931kaW//m8kGu1617BFsfEWfyFc+yotujvZJYBUKtrK1atBysOIkurayumlRzoVKd6u/scHdU+0888izaR6Nj0d+4adgdGd9J21su6OtFxoQs3P/Z+vKvzncGGHbuV7Ote1j3vHDQAvbq2Yu7decDgIHqR7t15YCZLTZPoWFdd3+SbF5/2LNrEUdoaeqeik7bNUdrS6521QrdiTx97t7dtjtLWuaGUH3ur++wLlUxHtUXV8UU7PTIb4bp1aAAcHCUaatDgaC6f2wHAuxp8beD//vm8C1e6Ir/TEmexzqsMm8AY5ObELef0sQHgMGmp846dV0dVxxf/8vHPeuOEBsCKg4jGwIqDaIhhFQfw5/1Iy07F9d3g0pbevwgd1RaRCkVmMq10qv/htX9Mxz0WKw6iC1hdWzHN8nS2H++ePEH+q07pVDfL0/aPqD+FFQfREKMqjtxPP/pJtSTL5kb9la/kBZWPbfQnfaU2k70G4TwOosuRJDp2noSfus3y9KU+sOkyRCoU+/Fu1koO9KODh4WW8Q/DVoWIrLFVIRqiaKsCAP/03z905yoLLgDMVRfG2mbwReiotminR+YwOVA/ev3HFxrbyLFVIbokjw4eajShJktNGanQ+SoER34npe41VN1rXNr5sFUhuiT37jzQjw4eZoFbM/k+F18F/XPRtutRhmGrQjSETauS++lHP3EAOFeC5aEb/rxIp+dsHCYH5kev/zgZ/a7iWHEQkTVWHERDjFNxAMfrWP5m8TtlAKh59dMb5rxwpxfdXcacjUFYcRC9APfuPDDbvefKk162H+9mG+G6Rn8Z+4v+8t0gi7OeirOewvBl/WPjXRWiF+TRwcPs0cFDcav5FxI4ftjRl/G5zfK0aZanx9pnoyi2KkRkja0KEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRNQYHEVljcBCRtf8DKaalQtudCCUAAAAASUVORK5CYII=);
}

._fd-view-product.vue2 > div {
    color: #00C050;
}

._fd-view-product:hover {
    background-color: #FFFFFF;
    color: rgb(153, 153, 153);
}

._fd-view-product > div {
    display: flex;
    justify-content: space-between;
    flex-direction: row;
    font-weight: 600;
    font-size: 15px;
    color: #2E73FF;
    margin-bottom: 6px;
}

._fd-view-product > div > span {
    font-size: 14px;
}

._fc-top-bar {
    width: 100%;
    height: 50px;
    background: #ffffff;
    display: flex;
    align-items: center;
    padding: 0 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    border-bottom: 1px solid #e8e8e8;
}

._fc-top-logo {
    display: flex;
    align-items: center;
    gap: 12px;
}

._fc-logo-img {
    height: 32px;
    width: 32px;
    object-fit: contain;
}

._fc-logo-text {
    color: #5B4FA8;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.5px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
</style>
