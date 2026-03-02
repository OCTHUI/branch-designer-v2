<template>
    <div class="_fd-language-config">
        <div class="_fc-l-label">{{ t('language.name') }}</div>
        <div class="_fc-l-info">
            {{ t('warning.language') }}
        </div>
        <div class="_fd-lc-header">
            <el-button size="small" @click="addColumn">{{ t('language.add') }}</el-button>
            <el-button size="small" @click="openImportDialog">
                <i class="fc-icon icon-group"></i> 批量导入
            </el-button>
            <el-button size="small" type="danger" plain :disabled="!selected.length" @click="batchRmColumn">
                {{ t('language.batchRemove') }}
            </el-button>
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
                    <el-form-item label="目标语言">
                        <el-select v-model="importLocale" placeholder="请选择" style="width: 100%;">
                            <template v-for="item in localeOptions" :key="item.value">
                                <el-option :label="item.label" :value="item.value"></el-option>
                            </template>
                        </el-select>
                    </el-form-item>
                    
                    <el-form-item label="上传文件">
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
                            预览（前 5 条）：共 {{ importPreview.total }} 个词条
                        </div>
                        <el-table :data="importPreview.items" size="small" border>
                            <el-table-column prop="key" label="Key" width="120"></el-table-column>
                            <el-table-column prop="value" :label="importLocale === 'zh-cn' ? '简体中文' : 'English'"></el-table-column>
                        </el-table>
                    </div>
                </el-form>
            </div>
            
            <template #footer>
                <el-button size="small" @click="importDialogVisible = false">取消</el-button>
                <el-button size="small" type="primary" @click="confirmImport" :loading="importing">
                    导入
                </el-button>
            </template>
        </el-dialog>
        <div class="_fd-lc-body">
            <el-table :data="column" size="small" ref="table"
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
        </div>
    </div>

</template>

<script>
import {defineComponent} from 'vue';
import {copyTextToClipboard} from '../../utils';

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
            importData: []
        }
    },
    methods: {
        copy(key) {
            copyTextToClipboard(key);
        },
        addColumn() {
            this.column.unshift({
                key: this.randomString(),
                input: true,
            })
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
        confirmImport() {
            if (this.importData.length === 0) {
                this.$message.warning('请先选择文件');
                return;
            }
            
            const language = this.designer.setupState.formOptions.language;
            if (!language[this.importLocale]) {
                language[this.importLocale] = {};
            }
            
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
            this.$message.success(`成功导入 ${count} 个新词条`);
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
        },
        saveColumn(row, input) {
            row.input = input || false;
            const language = this.designer.setupState.formOptions.language;
            this.localeOptions.forEach(item => {
                if (!language[item.value]) {
                    language[item.value] = {};
                }
                language[item.value][row.key] = row[item.value];
            })
        },
        rmColumn(idx) {
            const row = this.column[idx];
            this.column.splice(idx, 1);
            const language = this.designer.setupState.formOptions.language;
            this.localeOptions.forEach(item => {
                if (language[item.value]) {
                    delete language[item.value][row.key]
                }
            })
        },
        batchRmColumn() {
            this.selected.forEach(item => {
                this.rmColumn(this.column.indexOf(item));
            });
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
    mounted() {
        const language = this.designer.setupState.formOptions.language || {};
        const column = {};
        Object.keys(language).forEach(lang => {
            Object.keys(language[lang]).forEach(key => {
                if (!column[key]) {
                    column[key] = {
                        key: key,
                    }
                }
                column[key][lang] = language[lang][key];
            })
        });
        this.column = Object.values(column);
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
    justify-content: flex-end;
    margin-bottom: 12px;
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
</style>
