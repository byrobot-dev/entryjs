/*
 *
 */
"use strict";

goog.provide("Entry.Parser");

goog.require("Entry.JsAstGenerator");
goog.require("Entry.PyAstGenerator");

goog.require("Entry.BlockToJsParser");
goog.require("Entry.BlockToPyParser");
goog.require("Entry.JsToBlockParser");
goog.require("Entry.PyToBlockParser");

goog.require("Entry.TextCodingUtil");
goog.require("Entry.PyHint");
goog.require("Entry.Console")


Entry.Parser = function(mode, type, cm, syntax) {
    this._mode = mode; // maze ai workspace
    this.syntax = {}; //for maze
    this.codeMirror = cm;
    this._lang = syntax || "js"; //for maze
    this._type = type;
    this.availableCode = [];
    this._syntax_cache = {};
    this._pyThreadCount = 1;
    this._pyBlockCount = {};

    Entry.Parser.PARSE_GENERAL = 1;
    Entry.Parser.PARSE_SYNTAX = 2;
    Entry.Parser.PARSE_VARIABLE = 3;

    Entry.Parser.BLOCK_SKELETON_BASIC = "basic";
    Entry.Parser.BLOCK_SKELETON_BASIC_LOOP = "basic_loop";
    Entry.Parser.BLOCK_SKELETON_BASIC_DOUBLE_LOOP = "basic_double_loop";

    /*this.syntax.js = this.mappingSyntaxJs(mode);
    this.syntax.py = this.mappingSyntaxPy(mode);*/

    this._console = new Entry.Console();


    switch (this._lang) {
        case "js":
            this._parser = new Entry.JsToBlockParser(this.syntax);
            var syntax = this.syntax;

            var assistScope = {};

            for(var key in syntax.Scope ) {
                assistScope[key + '();\n'] = syntax.Scope[key];
            }

            if('BasicIf' in syntax) {
                assistScope['front'] = 'BasicIf';
            }

            cm.on("keyup", function (cm, event) {
                if ((event.keyCode >= 65 && event.keyCode <= 95) ||
                    event.keyCode == 167 || event.keyCode == 190) {
                    CodeMirror.showHint(cm, null, {completeSingle: false, globalScope:assistScope});
                }
            });

            break;
        case "py":
            this._parser = new Entry.PyToBlockParser(this.syntax);

            var syntax = this.syntax;

            var assistScope = {};

            for(var key in syntax.Scope ) {
                assistScope[key + '();\n'] = syntax.Scope[key];
            }

            if('BasicIf' in syntax) {
                assistScope['front'] = 'BasicIf';
            }

            CodeMirror.commands.javascriptComplete = function (cm) {
                CodeMirror.showHint(cm, null, {globalScope:assistScope});
            }

            cm.on("keyup", function (cm, event) {
                if ((event.keyCode >= 65 && event.keyCode <= 95) ||
                    event.keyCode == 167 || event.keyCode == 190) {
                    CodeMirror.showHint(cm, null, {completeSingle: false, globalScope:assistScope});
                }
            });
            break;

        case "blockJs":
            this._parser = new Entry.BlockToJsParser(this.syntax);
            var syntax = this.syntax;
            break;

        case "blockPy":
            this._parser = new Entry.BlockToPyParser(this.syntax);
            var syntax = this.syntax;
            break;
    }
};

(function(p) {
    p.setParser = function(mode, type, cm) {
        this._mode = mode;
        this._type = type;
        this._cm = cm;

        /*if (mode === Entry.Vim.MAZE_MODE) {
            this._stageId = Number(Ntry.configManager.getConfig('stageId'));
            var configCode = NtryData.config[this._stageId].availableCode;
            var playerCode = NtryData.player[this._stageId].code;
            this.setAvailableCode(configCode, playerCode);
        }*/

        console.log("real mode", mode);

        this.syntax = this.mappingSyntax(mode);

        switch (type) {
            case Entry.Vim.PARSER_TYPE_JS_TO_BLOCK:
                this._parser = new Entry.JsToBlockParser(this.syntax);

                this._parserType = Entry.Vim.PARSER_TYPE_JS_TO_BLOCK;

                break;

            case Entry.Vim.PARSER_TYPE_PY_TO_BLOCK:
                this._parser = new Entry.PyToBlockParser(this.syntax);

                this._parserType = Entry.Vim.PARSER_TYPE_PY_TO_BLOCK;

                break;

            case Entry.Vim.PARSER_TYPE_BLOCK_TO_JS:
                this._parser = new Entry.BlockToJsParser(this.syntax);

                var syntax = this.syntax;
                var assistScope = {};

                for(var key in syntax.Scope) {
                    assistScope[key + '();\n'] = syntax.Scope[key];
                }

                //if('BasicIf' in syntax) {
                    //assistScope['front'] = 'BasicIf';
                //}

                cm.on("keydown", function (cm, event) {
                    var keyCode = event.keyCode;

                    if ((keyCode >= 65 && keyCode <= 95) ||
                        keyCode == 167 || (!event.shiftKey && keyCode == 190)) {
                        CodeMirror.showHint(cm, null, {
                            completeSingle: false, globalScope:assistScope
                        });
                    }
                });

                this._parserType = Entry.Vim.PARSER_TYPE_JS_TO_BLOCK;

                break;

            case Entry.Vim.PARSER_TYPE_BLOCK_TO_PY:
                this._parser = new Entry.BlockToPyParser(this.syntax);
                cm.setOption("mode", {name: "python", globalVars: true});
                cm.markText({line: 0, ch: 0}, {line: 3}, {readOnly: true});
                this._parserType = Entry.Vim.PARSER_TYPE_BLOCK_TO_PY;

                break;
        }
    };

    p.parse = function(code, parseMode) {
        console.log("this.syntax", this.syntax); 
        console.log("this._syntax_cache", this._syntax_cache); 
        var type = this._type;
        var result = null;

        //console.log("type", type);

        switch (type) {
            case Entry.Vim.PARSER_TYPE_JS_TO_BLOCK:
                try {
                    //var astTree = acorn.parse(code);
                    //var threads = code.split('\n\n');
                    //console.log("code", code);
                    var threads = [];
                    threads.push(code);

                    //////console.log("threads", threads);

                    var astArray = [];

                    for(var index in threads) {
                        var thread = threads[index];
                        thread = thread.trim();
                        var ast = acorn.parse(thread);
                        //if(ast.type == "Program" && ast.body.length != 0)
                        astArray.push(ast);
                    }

                    result = this._parser.Program(astArray);
                } catch (error) {
                    if (this.codeMirror) {
                        //console.log("error.loc", error.loc);
                        var annotation;
                        if (error instanceof SyntaxError) {
                            annotation = {
                                from: {line: error.loc.line - 1, ch: 0},
                                to: {line: error.loc.line - 1, ch: error.loc.column}
                            }
                            /*annotation = {
                                from: {line: error.loc.line - 1, ch: error.loc.column - 2},
                                to: {line: error.loc.line - 1, ch: error.loc.column + 1}
                            }*/
                            error.message = "문법(Syntax) 오류입니다.";
                            error.type = 1;
                        } else {
                            annotation = this.getLineNumber(error.node.start, error.node.end);
                            annotation.message = error.message;
                            annotation.severity = "converting error";

                            error.type = 2;
                        }

                        this.codeMirror.markText(
                            annotation.from, annotation.to, {
                            className: "CodeMirror-lint-mark-error",
                            __annotation: annotation,
                            clearOnEnter: true
                        });

                        if(error.title) {
                            var errorTitle = error.title;
                        }
                        else {
                            var errorTitle = '문법 오류';
                        }

                        if(error.type == 2 && error.message) {
                            var errorMsg = error.message;
                        }
                        else if(error.type == 2 && !error.message) {
                            var errorMsg = '자바스크립트 코드를 확인해주세요.';
                        }
                        else  if(error.type == 1) {
                            var errorMsg = '자바스크립트 문법을 확인해주세요.';
                        }
                        Entry.toast.alert(errorTitle, errorMsg);
                        var mode = {};
                        mode.boardType = Entry.Workspace.MODE_BOARD;
                        mode.textType = Entry.Vim.TEXT_TYPE_JS;
                        mode.runType = Entry.Vim.MAZE_MODE;
                        Ntry.dispatchEvent("textError", mode);
                        throw error;
                    }
                    result = [];
                }
                break;
            case Entry.Vim.PARSER_TYPE_PY_TO_BLOCK:
                try {
                    this._pyBlockCount = {};
                    this._pyThreadCount = 1;
                    //this._marker.clear(); 

                    var pyAstGenerator = new Entry.PyAstGenerator();

                    //Entry.TextCodingUtil.prototype.makeThreads(code);
                    //var threads = code.split('\n\n');
                    var threads = this.makeCodeToThreads(code);
                    console.log("code", code);

                    for(var i in threads) {
                        var thread = threads[i];
                        if(thread.search("import") != -1) {
                            threads[i] = "";
                            continue;
                        } else if(thread.charAt(0) == '#') {
                            threads[i] = "";
                            continue;
                        }

                        //thread = Entry.TextCodingUtil.prototype.entryEventFuncFilter(thread);
                        threads[i] = thread;
                    }

                    var astArray = [];
                    var tCount = 0;
                    var ast;
                    console.log("threads", threads);
                    threads.shift();
                    threads.shift();

                    for(var index in threads) {
                        var thread = threads[index]; 
                        console.log("ttt thread", thread);
                        if(thread.length != 0 && thread != "") {
                            tCount++;
                            this._pyThreadCount = parseInt(tCount);

                            /*if(!Entry.TextCodingUtil.prototype.includeEntryEventKeyBlock(thread)) {
                                ast = pyAstGenerator.generate(thread);
                            }*/
                            console.log("success??", ast);
                            thread = Entry.TextCodingUtil.prototype.entryEventFuncFilter(thread);
                            console.log("real thread", thread);
                            ast = pyAstGenerator.generate(thread);
                        }

                        if(!ast) {
                            if(this._pyThreadCount > 1) {
                                tCount--;
                                this._pyThreadCount--; 
                            }
                            continue;
                        }
                        
                        if(thread.length != 0 && thread != "") {
                            var tToken = thread.split('\n');
                            tToken.pop();
                            var idx = parseInt(this._pyThreadCount).toString();
                            this._pyBlockCount[idx] =  tToken.length;
                            console.log("this._pyBlockCount", this._pyBlockCount);
                        }

                        if(ast.type == "Program" && ast.body.length != 0) 
                            astArray.push(ast);
                    }

                    result = this._parser.Program(astArray);
                    this._parser._variableMap.clear();

                    break;
                } catch(error) {
                    if (this.codeMirror) { 
                        this._threeLine = false;
                        console.log("came here error", error);
                        var annotation;
                        var line;
                        var isSyntaxLineEmpty = false;
                        if (error instanceof SyntaxError) {
                            console.log("py error type 1", error.loc);
                            var errorInfo = this.findSyntaxErrorInfo(error);

                            console.log("errorInfo", errorInfo);

                            //errorInfo.line -= 1;

                            if(errorInfo.unknown)
                                error.message = '해당 구문 범위안에서 문법오류가 존재합니다.';

                            var updateLineInfo = this.updateLineEmpty(errorInfo.line);

                            if(updateLineInfo.isLineEmpty) {
                                errorInfo.line = updateLineInfo.line;
                                errorInfo.start = updateLineInfo.start;
                                errorInfo.end = updateLineInfo.end;
                                error.message = updateLineInfo.message;
                            }
                            
                            annotation = {
                                from: {line: errorInfo.line-1, ch: errorInfo.start},
                                to: {line: errorInfo.line-1, ch: errorInfo.end}
                            }

                            if(this._threeLine) {
                                annotation.from.line = errorInfo.from.line;
                                annotation.to.line = errorInfo.to.line;
                            }

                            if(!error.message)
                                error.message = "파이썬 문법 오류입니다.";

                            error.type = 1;

                            /*annotation = {
                                from: {line: error.loc.line - 1, ch: error.loc.column - 2},
                                to: {line: error.loc.line - 1, ch: error.loc.column + 1}
                            }*/
                        } else {
                            console.log("py error type 2", error);
                            var errorInfo = error;
                            
                            var errorLine = this.findErrorLineForConverting(errorInfo.line);
                            errorInfo.line = errorLine;

                            /*annotation = this.getLineNumber(error.node.start, error.node.end);
                            annotation.message = error.message;
                            annotation.severity = "error";*/

                            var ch = this.findConvertingTargetChInfo(errorInfo.line);
                            
                            annotation = {
                                from: {line: errorInfo.line - 1, ch: ch.start},
                                to: {line: errorInfo.line - 1, ch: ch.end}
                            }

                            if(!error.message)
                                error.message = "지원하지 않는 코드입니다.";

                            error.type = 2;  
                             
                            /*annotation = this.getLineNumber(error.node.start, error.node.end);
                            annotation.message = error.message;
                            annotation.severity = "block_convert_error";*/   
                        }

                        console.log("annotation", annotation);
                        
                        var option = {
                            className: "CodeMirror-lint-mark-error",
                            __annotation: annotation,
                            clearOnEnter: true,
                            inclusiveLeft: true,
                            inclusiveRigth: true,
                            clearWhenEmpty: false 
                        };

                        console.log("this._threeLine", this._threeLine);

                        

                        this._marker = this.codeMirror.markText(
                            annotation.from, annotation.to, option);
                        

                        console.log("came here error2", error);

                        console.log("came here error2 title", error.title);
                        console.log("came here error2 message", error.message);


                        if(error.title)
                            var errorTitle = error.title;
                        else {
                            if(error.type == 1)
                                var errorTitle = '문법 오류(Syntax Error)';
                            else if(error.type == 2)
                                var errorTitle = '블록변환 오류(Converting Error)';
                        }

                        line = parseInt(errorInfo.line); 

                        if(error.message && line)
                            var errorMsg = error.message + ' \n(line: ' + (annotation.from.line+1) + '~' + (annotation.to.line+1)  + ')';
                        else {
                            if(error.message) {
                                var errorMsg = error.message;
                            }
                            else {
                                if(error.type == 1)
                                    var errorMsg = '파이썬 문법을 확인해주세요';
                                else if(error.type == 2)
                                    var errorMsg = '블록으로 변환되는 코드인지 확인해주세요';
                            }
                        }
                        
                        Entry.toast.alert(errorTitle, errorMsg);
                        
                        throw error;
                    }

                    result = [];
                }

                break;

            case Entry.Vim.PARSER_TYPE_BLOCK_TO_JS:
                var textCode = this._parser.Code(code, parseMode);
                /*var textArr = textCode.match(/(.*{.*[\S|\s]+?}|.+)/g);
                ////console.log("textCode", textCode);
                if(Array.isArray(textArr)) {
                    result = textArr.reduce(function (prev, current, index) {
                        var temp = '';
                        if(index === 1) {
                            prev = prev + '\n';
                        }
                        if(current.indexOf('function') > -1) {
                            temp = current + prev;
                        } else {
                            temp = prev + current;
                        }
                        return temp + '\n';
                    });
                } else {
                    result = '';
                }*/
                

                result = textCode;

                break;

            case Entry.Vim.PARSER_TYPE_BLOCK_TO_PY:
                try{
                    console.log("parser parsemode", parseMode);
                    var textCode = this._parser.Code(code, parseMode);

                    if (!this._pyHinter)
                        this._pyHinter = new Entry.PyHint();

                    result = textCode;
                    
                }
                catch(error) {
                    var errorTitle = error.title;
                    var errorMsg = error.message;
                    
                    Entry.toast.alert(errorTitle, errorMsg);
                }

                break;
        }

        return result;
    };

    p.getLineNumber = function (start, end) {
        var value = this.codeMirror.getValue();
        var lines = {
            'from' : {},
            'to' : {}
        };

        var startline = value.substring(0, start).split(/\n/gi);
        lines.from.line = startline.length - 1;
        lines.from.ch = startline[startline.length - 1].length;

        var endline = value.substring(0, end).split(/\n/gi);
        lines.to.line = endline.length - 1;
        lines.to.ch = endline[endline.length - 1].length;

        return lines;
    };

    p.mappingSyntax = function(mode) {
        if (this._syntax_cache[mode])
            return this._syntax_cache[mode];

        var types = Object.keys(Entry.block);
        var syntax = {};

        for (var i = 0; i < types.length; i++) {
            var type = types[i];
            var block = Entry.block[type];

            if(mode === Entry.Vim.MAZE_MODE) {
                if(this.availableCode.indexOf(type) > -1) {
                    var syntaxArray = block.syntax;
                    if (!syntaxArray)
                        continue;

                    if(block.syntax.py)
                        continue;

                    var syntaxTemp = syntax;

                    for (var j = 0; j < syntaxArray.length; j++) {
                        var key = syntaxArray[j];
                        if (j === syntaxArray.length - 2 &&
                            typeof syntaxArray[j + 1] === "function") {
                            syntaxTemp[key] = syntaxArray[j + 1];
                            break;
                        }
                        if (!syntaxTemp[key]) {
                            syntaxTemp[key] = {};
                        }
                        if (j === syntaxArray.length - 1) {
                            syntaxTemp[key] = type;
                        } else {
                            syntaxTemp = syntaxTemp[key];
                        }
                    }
                }
            }
            else {
                if(mode === Entry.Vim.WORKSPACE_MODE) {
                    var blockList = Entry.block;

                    for (var key in blockList) {
                        var pyBlockSyntax = {};
                        var block = blockList[key];
                        var pySyntax = null;

                        if(block.syntax && block.syntax.py) {
                            pySyntax = block.syntax.py;
                        }

                        if (!pySyntax)
                            continue;

                        pySyntax = String(pySyntax);
                        var tokens = pySyntax.split('(');
                        if(tokens[0].length != 0)
                            pySyntax = tokens[0];

                        syntax[pySyntax] = key;
                    }
                }
            }
        }

        this._syntax_cache[mode] = syntax;

        return syntax;
    };

    p.setAvailableCode = function (configCode, playerCode) {
        var availableList = [];
        var blocks;
        if (configCode instanceof Entry.Code)
            blocks = configCode.getBlockList();
        else {
            configCode.forEach(function (items, i) {
                blocks.concat(items);
            });
        }

        blocks.forEach(function (item) {
            availableList.push(item.type);
        });

        blocks = [];
        if (playerCode instanceof Entry.Code)
            blocks = playerCode.getBlockList();
        else {
            playerCode.forEach(function (items, i) {
                blocks.concat(items);
            });
        }

        blocks.forEach(function(item) {
            if(availableList.indexOf(item.type) === -1)
                availableList.push(item.type);
        });

        this.availableCode = this.availableCode.concat(availableList);
    };

    p.findErrorLineForConverting = function(blockCount) {
        console.log("blockCount", blockCount); 
        var errorLine = 0;

        var contents = this.codeMirror.getValue();
        var contentsArr = contents.split("\n");
        console.log("contentsArr44", contentsArr);

        if(blockCount > contentsArr.length - 4) {
            errorLine = contentsArr.length;
            return errorLine;
        }

        
        var index = 0;
        for(var i = 4; i < contentsArr.length; i++) {
            var line = contentsArr[i];
            console.log("ljh line", line);
            if(line.trim().length == 0 || line.trim() == "else:")
                errorLine++;
            else 
                index++;
            console.log("iiiiii", i); 
            console.log("index", index, "blockCount", blockCount);
            if(index == blockCount) {
                errorLine += index;
                break;
            }
        }

        errorLine += 4;
        console.log("errorLine kk", errorLine);

        return errorLine;
    };

    p.findConvertingTargetChInfo = function(errorLine) {
        var result = {};

        var contents = this.codeMirror.getValue();
        var contentsArr = contents.split("\n");

        console.log("contentsArr1", contentsArr);
        
        console.log("errorline", errorLine);
        var currentLineCount = 0;
        console.log("this._pythre", this._pyThreadCount); 
        for(var c = 1; c < this._pyThreadCount; c++) {
            console.log("aaa", this._pyBlockCount);
            var idx = c.toString();
            console.log("idx", idx);
            var count = this._pyBlockCount[idx]; 
            console.log("count c", count);  
            currentLineCount += count;
        }

        result.line = currentLineCount + (this._pyThreadCount-1);

        //errorLine -= 4;

        for(var i = 0; i < contentsArr.length; i++) {
            var targetText = contentsArr[i];
            console.log("targetText", targetText);
            console.log("this._pyThreadCount", this._pyThreadCount); 

            if(targetText.trim().length != 0) {
                if((i+1) == errorLine) {
                    result.start = 0;
                    result.end = targetText.length;
                    break; 
                }
            }
        }
        
        console.log("findConvertingErrorInfo result", result);
        return result;
        
    };

    p.findSyntaxErrorInfo = function(error) {
        this._threeLine = false;
        var result = {};
        var line = error.loc.line;
        var column = error.loc.column
        var pos = error.pos;

        result.line = line;

        console.log("error.loc222", error.loc);

        var contents = this.codeMirror.getValue();
        var contentsArr = contents.split("\n");
        contentsArr.shift();
        contentsArr.shift();
        contentsArr.shift(); 
        contentsArr.shift();

        console.log("findSyntaxErrorInfo contentsArr1", contentsArr);
        console.log("this._pyThreadCount", this._pyThreadCount);

        for(var ca in contentsArr) {
            var arr = contentsArr[ca];
            if(arr.trim().length == 0)
                contentsArr[ca] = "";
        }

        console.log("findSyntaxErrorInfo contentsArr2", contentsArr);

        var currentLineCount = 0;
        console.log("this._pythre", this._pyThreadCount); 
        for(var c = 1; c < this._pyThreadCount; c++) {
            console.log("aaa", this._pyBlockCount);
            var idx = c.toString();
            console.log("idx", idx);
            var count = this._pyBlockCount[idx]; 
            console.log("count c", count);  
            currentLineCount += count;
        }

        console.log("currentLineCount", currentLineCount);
        console.log("this.pyBlockcount", this._pyBlockCount);

        var initEmptyLine = 0;
        var notShowTextLine = true;

        if(isNaN(column)) {
            line = contentsArr.length;
        }
        
        for(var i = 0; i < contentsArr.length; i++) {
            var targetText = contentsArr[i];
            console.log("targetText", targetText);
            console.log("this._pyThreadCount", this._pyThreadCount); 

            if(targetText.trim().length == 0 && notShowTextLine)
                initEmptyLine++;
            else
                notShowTextLine = false;


            if(line > contentsArr.length)
                line = contentsArr.length;

            if(i+1 == line) {
                console.log("i+1", i+1);
                result.line = i + 1 + currentLineCount + (this._pyThreadCount-1) + initEmptyLine;
                console.log("column", column);
                if(column == 0 && (i+1) == 2) {
                    console.log("type1"); 
                    result.line -= 1;
                    this._threeLine = true;
                }
                else if(column == 1 && (i+1) != 1) {
                    console.log("type2");
                    result.line -= 1;
                    this._threeLine = true;
                }
                else if(line == 1 && column == 0) {
                    console.log("type3");
                    result.line -= 1;
                    this._threeLine = true;
                } 
                else if(column == 2) {
                    console.log("type4");
                    result.line -= 1;
                    this._threeLine = true;
                }
                else if(column == 0) {
                    console.log("type5");
                    result.line -= 1;
                    this._threeLine = true;
                }

                result.line += 4;
                result.start = 0;

                if(targetText.length == 0)
                    result.end = 5;
                else
                    result.end = targetText.length;  

                break;

            }
        }
        
        if(isNaN(column)) {
            console.log("initEmptyLine", initEmptyLine);
            result.line = currentLineCount + (this._pyThreadCount-1) + 4 + 1 + initEmptyLine;
            result.start = 0;
            result.end = contentsArr[line-1].length; 
            result.unknown = true; 
        }

        if(this._threeLine) {
            var eLine = result.line - 1;
            result.from = {};
            result.from.line = eLine -1;
            result.to = {};
            result.to.line = eLine + 1;

            if(result.from.line > contentsArr.length + 4)
                result.from.line = contentsArr.length + 4;

            if(result.to.line > contentsArr.length + 4)
                result.to.line = contentsArr.length + 4;
        }

        console.log("findSyntaxErrorInfo result", result);
        return result;
        
    };

    p.updateLineEmpty = function(lineNumber) {
        console.log("lineNumber", lineNumber);
        var result = {};
        var contents = this.codeMirror.getValue();
        var contentsArr = contents.split("\n");
        console.log("contentsArr222", contentsArr);

        var text = contentsArr[lineNumber-1];

        if(text.trim().length == 0 && lineNumber > 3) {
            contentsArr[lineNumber-1] = "     ";
            var newContents = contentsArr.join("\n");
            console.log("newContents", newContents);
            this.codeMirror.setValue(newContents);
            result.isLineEmpty = true;
            result.line = lineNumber;
            result.start = 0;
            result.end = contentsArr[lineNumber-1].length;
            result.message = '들여쓰기(Indentation)가 정확한지 확인해주세요.';

            return result;
        }

        result.isLineEmpty = false;

        return result;
    };

    p.makeCodeToThreads = function(code) {
        console.log("mct code", code);
        var codeArr = code.split("\n");
        console.log("codeArr", codeArr); 
        var thread = '';
        var threadArr = [];

        for(var i in codeArr) {
            var textLine = codeArr[i];
            console.log("textLine", textLine);
            if(textLine.length != 0) {
                thread += textLine + '\n';
                console.log("jhlee thread", thread);
                if(i == codeArr.length-1)
                    threadArr.push(thread);
            }
            else {
                threadArr.push(thread);
                thread = '';
            }
        }

        console.log("threadArr", threadArr);

        return threadArr;

    };

})(Entry.Parser.prototype);