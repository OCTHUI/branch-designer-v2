<template>
    <div class="_fd-language-config">
        <div class="_fc-l-label">{{ t('language.name') }}</div>
        <div class="_fc-l-info">
            {{ t('warning.language') }}
        </div>
        <div class="_fd-lc-header">
            <div class="_fd-lc-header-left">
                <el-button size="small" @click="addColumn">{{ t('language.add') }}</el-button>
                <el-button size="small" @click="openImportDialog">
                    <i class="fc-icon icon-group"></i> {{ t('language.batchImport') }}
                </el-button>
                <el-button size="small" type="danger" plain :disabled="!selected.length" @click="batchRmColumn">
                    {{ t('language.batchRemove') }}
                </el-button>
            </div>
            <div class="_fd-lc-header-right">
                <el-input
                    v-model="searchText"
                    :placeholder="t('language.searchPlaceholder')"
                    size="small"
                    clearable
                    style="width: 200px;"
                    @input="handleSearch"
                >
                    <template #prefix>
                        <i class="el-icon-search"></i>
                    </template>
                </el-input>
            </div>
        </div>
        
        <!-- 批量导入对话框 -->
        <el-dialog v-model="importDialogVisible" :title="t('language.batchImport')" width="500px">
            <div class="_fd-import-dialog">
                <el-alert
                    :title="t('language.importTip')"
                    type="info"
                    :closable="false"
                    show-icon
                    style="margin-bottom: 16px;"
                ></el-alert>
                
                <el-form label-width="100px">
                    <el-form-item :label="t('language.targetLanguage')">
                        <el-select v-model="importLocale" :placeholder="t('language.pleaseSelect')" style="width: 100%;">
                            <template v-for="item in localeOptions" :key="item.value">
                                <el-option :label="item.label" :value="item.value"></el-option>
                            </template>
                        </el-select>
                    </el-form-item>
                    
                    <el-form-item :label="t('language.uploadFile')">
                        <input 
                            type="file" 
                            ref="fileInput"
                            accept=".ts,.js"
                            @change="handleFileChange"
                            style="width: 100%;"
                        />
                    </el-form-item>
                    
                    <div v-if="importPreview.length > 0" class="_fd-import-preview">
                        <div class="_fd-import-preview-title">
                            {{ t('language.importPreview') }}: {{ importPreview.total }} {{ t('language.entries') }}
                        </div>
                        <el-table :data="importPreview.items" size="small" border>
                            <el-table-column prop="key" label="Key" width="120"></el-table-column>
                            <el-table-column prop="value" :label="importLocale === 'zh-cn' ? t('language.simplifiedChinese') : t('language.english')"></el-table-column>
                        </el-table>
                    </div>
                </el-form>
            </div>
            
            <template #footer>
                <el-button size="small" @click="importDialogVisible = false">{{ t('language.cancel') }}</el-button>
                <el-button size="small" type="primary" @click="confirmImport" :loading="importing">
                    {{ t('language.import') }}
                </el-button>
            </template>
        </el-dialog>
        <div class="_fd-lc-body">
            <el-table :data="paginatedData" size="small" ref="table"
                      @selection-change="selectionChange" row-key="key">
                <el-table-column type="selection" width="30px"></el-table-column>
                <el-table-column prop="key" label="Key" width="90px"></el-table-column>
                <template v-for="item in localeOptions" :key="item.value">
                    <el-table-column :prop="item.value" :label="item.label" min-width="100px">
                        <template #default="scope">
                            <template v-if="scope.row.input">
                                <el-input size="small" v-model="scope.row[item.value]" @blur="saveColumn(scope.row, true)"></el-input>
                            </template>
                            <template v-else>
                                {{ scope.row[item.value] || '-' }}
                            </template>
                        </template>
                    </el-table-column>
                </template>
                <el-table-column width="75px" :label="t('tableOptions.handle')" fixed="right">
                    <template #default="scope">
                        <div class="_fd-lc-handle">
                            <i class="fc-icon icon-edit" v-if="!scope.row.input" @click="scope.row.input = true"></i>
                            <i class="fc-icon icon-check" v-else @click="saveColumn(scope.row)"></i>
                            <i class="fc-icon icon-group" @click="copy(scope.row.key)"></i>
                            <i class="fc-icon icon-delete-circle" @click="rmColumn(scope.$index)"></i>
                        </div>
                    </template>
                </el-table-column>
            </el-table>
            
            <!-- 分页 -->
            <div class="_fd-lc-pagination">
                <el-pagination
                    v-model:current-page="currentPage"
                    v-model:page-size="pageSize"
                    :page-sizes="[50, 100, 200, 500]"
                    :total="totalEntries"
                    layout="total, sizes, prev, pager, next, jumper"
                    @size-change="handleSizeChange"
                    @current-change="handleCurrentChange"
                />
            </div>
        </div>
    </div>

</template>

<script>
import {defineComponent} from 'vue';
import {copyTextToClipboard} from '../../utils';

// 后端 API 基础地址
const API_BASE = 'http://localhost:3080/api';

export default defineComponent({
    name: 'LanguageConfig',
    inject: ['designer'],
    computed: {
        localeOptions() {
            return this.designer.setupState.getConfig('localeOptions', [
                {value: 'zh-cn', label: '简体中文'},
                {value: 'en', label: 'English'},
            ]);
        },
        t() {
            return this.designer.setupState.t;
        },
    },
    data() {
        return {
            column: [],
            uni: 0,
            selected: [],
            importDialogVisible: false,
            importLocale: 'zh-cn',
            importing: false,
            importPreview: {
                items: [],
                total: 0
            },
            importData: [],
            persistEnabled: false,
            persistError: null,
            // 分页
            currentPage: 1,
            pageSize: 50,
            // 搜索
            searchText: ''
        }
    },
    computed: {
        localeOptions() {
            return this.designer.setupState.getConfig('localeOptions', [
                {value: 'zh-cn', label: '简体中文'},
                {value: 'en', label: 'English'},
            ]);
        },
        t() {
            return this.designer.setupState.t;
        },
        // 搜索过滤后的数据
        filteredColumn() {
            if (!this.searchText) {
                return this.column;
            }
            const search = this.searchText.toLowerCase();
            return this.column.filter(row => {
                // 搜索 Key
                if (row.key.toLowerCase().includes(search)) {
                    return true;
                }
                // 搜索所有语言的值
                for (const lang of this.localeOptions.map(o => o.value)) {
                    const value = row[lang] || '';
                    if (value.toLowerCase().includes(search)) {
                        return true;
                    }
                }
                return false;
            });
        },
        // 分页数据（基于过滤后的数据）
        paginatedData() {
            const start = (this.currentPage - 1) * this.pageSize;
            const end = start + this.pageSize;
            return this.filteredColumn.slice(start, end);
        },
        totalEntries() {
            return this.filteredColumn.length;
        }
    },
    methods: {
        /**
         * 从后端加载语言包
         */
        async loadLocale() {
            try {
                const response = await fetch(`${API_BASE}/locale`);
                if (!response.ok) throw new Error('加载失败');
                const data = await response.json();
                
                // 完全替换为后端数据（后端是唯一数据源）
                const formOptions = this.designer.setupState.formOptions;
                formOptions.language = {};
                
                Object.keys(data).forEach(lang => {
                    formOptions.language[lang] = { ...data[lang] };
                });
                
                this.persistEnabled = true;
                this.refreshColumn();
                console.log('🌍 语言包已从文件加载，词条数:', this.column.length);
            } catch (error) {
                console.warn('⚠️ 无法连接持久化服务，使用内存模式:', error.message);
                this.persistEnabled = false;
                this.persistError = error.message;
                this.refreshColumn();
            }
        },
        
        /**
         * 保存完整语言包
         */
        async saveLocale() {
            if (!this.persistEnabled) return;
            
            try {
                const language = this.designer.setupState.formOptions.language || {};
                const response = await fetch(`${API_BASE}/locale`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(language)
                });
                
                if (!response.ok) throw new Error('保存失败');
                console.log('✅ 语言包已保存到文件');
            } catch (error) {
                console.error('❌ 保存语言包失败:', error.message);
            }
        },
        
        /**
         * 更新单个词条
         */
        async updateLocaleEntry(lang, key, value) {
            if (!this.persistEnabled) return;
            
            try {
                await fetch(`${API_BASE}/locale/${encodeURIComponent(lang)}/${encodeURIComponent(key)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value })
                });
            } catch (error) {
                console.error('更新词条失败:', error.message);
            }
        },
        
        /**
         * 批量导入词条
         */
        async batchImportLocale(lang, entries) {
            if (!this.persistEnabled) return;
            
            try {
                const response = await fetch(`${API_BASE}/locale/${encodeURIComponent(lang)}/batch`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entries })
                });
                
                if (!response.ok) throw new Error('导入失败');
                const result = await response.json();
                return result;
            } catch (error) {
                console.error('批量导入失败:', error.message);
                return null;
            }
        },
        
        /**
         * 批量删除词条
         */
        async batchDeleteLocale(lang, keys) {
            if (!this.persistEnabled) return;
            
            try {
                const response = await fetch(`${API_BASE}/locale/${encodeURIComponent(lang)}/batch`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keys })
                });
                
                if (!response.ok) throw new Error('删除失败');
                const result = await response.json();
                return result;
            } catch (error) {
                console.error('批量删除失败:', error.message);
                return null;
            }
        },
        
        copy(key) {
            copyTextToClipboard(key);
        },
        async addColumn() {
            const newKey = this.randomString();
            this.column.unshift({
                key: newKey,
                input: true,
            });
            // 持久化：为每个语言添加空词条
            await this.saveLocale();
        },
        openImportDialog() {
            this.importDialogVisible = true;
            this.importLocale = 'zh-cn';
            this.importPreview = { items: [], total: 0 };
            this.importData = [];
            if (this.$refs.fileInput) {
                this.$refs.fileInput.value = '';
            }
        },
        handleFileChange(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                this.parseTsFile(content);
            };
            reader.readAsText(file, 'utf-8');
        },
        parseTsFile(content) {
            const pairs = [];
            const regex = /^  ([A-Z_0-9]+):\s*'([^']+)'/gm;
            let match;
            
            while ((match = regex.exec(content)) !== null) {
                pairs.push({ key: match[1], value: match[2] });
            }
            
            this.importData = pairs;
            this.importPreview = {
                items: pairs.slice(0, 5),
                total: pairs.length
            };
        },
        async confirmImport() {
            if (this.importData.length === 0) {
                this.$message.warning('请先选择文件');
                return;
            }
            
            const language = this.designer.setupState.formOptions.language;
            if (!language[this.importLocale]) {
                language[this.importLocale] = {};
            }
            
            // 持久化批量导入
            if (this.persistEnabled) {
                this.importing = true;
                const entries = this.importData.map(item => ({
                    key: item.key,
                    value: item.value
                }));
                
                const result = await this.batchImportLocale(this.importLocale, entries);
                this.importing = false;
                
                if (result) {
                    // 更新内存
                    entries.forEach(({ key, value }) => {
                        language[this.importLocale][key] = value;
                    });
                    
                    this.refreshColumn();
                    this.importDialogVisible = false;
                    this.$message.success(`成功导入 ${result.count} 个新词条`);
                    return;
                }
            }
            
            // 降级：仅内存模式
            let count = 0;
            this.importData.forEach(item => {
                if (!language[this.importLocale][item.key]) {
                    language[this.importLocale][item.key] = item.value;
                    count++;
                }
            });
            
            // 刷新列表
            this.refreshColumn();
            
            this.importDialogVisible = false;
            await this.saveLocale();
            this.$message.success(`成功导入 ${count} 个新词条（内存模式）`);
        },
        refreshColumn() {
            const language = this.designer.setupState.formOptions.language || {};
            const column = {};
            Object.keys(language).forEach(lang => {
                Object.keys(language[lang]).forEach(key => {
                    if (!column[key]) {
                        column[key] = { key: key };
                    }
                    column[key][lang] = language[lang][key];
                });
            });
            this.column = Object.values(column);
            // 刷新后重置到第一页
            this.currentPage = 1;
        },
        // 分页处理
        handleSizeChange(val) {
            this.pageSize = val;
            this.currentPage = 1;
        },
        handleCurrentChange(val) {
            this.currentPage = val;
        },
        // 搜索处理
        handleSearch() {
            // 搜索时重置到第一页
            this.currentPage = 1;
        },
        async saveColumn(row, input) {
            row.input = input || false;
            const language = this.designer.setupState.formOptions.language;
            
            // 更新内存
            this.localeOptions.forEach(item => {
                if (!language[item.value]) {
                    language[item.value] = {};
                }
                language[item.value][row.key] = row[item.value];
                // 持久化单个词条
                this.updateLocaleEntry(item.value, row.key, row[item.value]);
            });
            
            // 全量保存作为备份
            await this.saveLocale();
        },
        async rmColumn(idx) {
            // 分页后需要计算真实索引
            const realIdx = (this.currentPage - 1) * this.pageSize + idx;
            const row = this.column[realIdx];
            this.column.splice(realIdx, 1);
            const language = this.designer.setupState.formOptions.language;
            
            // 收集要删除的 keys
            const keysToDelete = [];
            this.localeOptions.forEach(item => {
                if (language[item.value]) {
                    delete language[item.value][row.key];
                    keysToDelete.push(row.key);
                }
            });
            
            // 持久化删除
            if (this.persistEnabled) {
                await this.batchDeleteLocale('zh-cn', [row.key]);
                await this.batchDeleteLocale('en', [row.key]);
            }
            await this.saveLocale();
        },
        async batchRmColumn() {
            if (this.selected.length === 0) return;
            
            // 按语言收集要删除的 keys
            const keysByLang = {};
            this.localeOptions.forEach(opt => {
                keysByLang[opt.value] = this.selected.map(item => item.key);
            });
            
            // 从内存中删除
            const language = this.designer.setupState.formOptions.language;
            this.selected.forEach(item => {
                this.localeOptions.forEach(opt => {
                    if (language[opt.value]) {
                        delete language[opt.value][item.key];
                    }
                });
            });
            
            // 从列表中移除
            this.selected.forEach(item => {
                const idx = this.column.indexOf(item);
                if (idx > -1) this.column.splice(idx, 1);
            });
            
            // 持久化批量删除
            if (this.persistEnabled) {
                for (const [lang, keys] of Object.entries(keysByLang)) {
                    await this.batchDeleteLocale(lang, keys);
                }
            }
            await this.saveLocale();
            
            this.selected = [];
        },
        selectionChange(list) {
            this.selected = list;
        },
        randomString() {
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            const charactersLength = characters.length;

            for (let i = 0; i < 7; i++) {
                result += characters.charAt(Math.floor(Math.random() * charactersLength));
            }
            return characters.charAt((this.uni++) % 26) + result;
        }
    },
    async mounted() {
        // 从后端加载语言包（系统启动时）
        await this.loadLocale();
    }

});
</script>

<style>
._fd-language-config {
    height: 100%;
    overflow: auto;
}

._fd-lc-body, ._fd-lc-header {
    padding: 0 12px;
}

._fd-lc-body {
    overflow: auto;
}

._fd-lc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

._fd-lc-header-left {
    display: flex;
    gap: 8px;
}

._fd-lc-header-right {
    display: flex;
    align-items: center;
}

._fd-language-config .el-table__cell {
    height: 34px;
}

._fd-language-config ._fc-l-info {
    margin-bottom: 12px;
}

._fd-lc-handle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
}

._fd-import-dialog {
    padding: 10px 0;
}

._fd-import-preview {
    margin-top: 16px;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    padding: 12px;
    background-color: #f5f7fa;
}

._fd-import-preview-title {
    font-size: 13px;
    color: #606266;
    margin-bottom: 8px;
    font-weight: 500;
}

._fd-lc-pagination {
    margin-top: 16px;
    padding: 12px 0;
    display: flex;
    justify-content: flex-end;
}
</style>
