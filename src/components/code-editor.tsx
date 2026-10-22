"use client";

import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Braces, ChevronDown, Library, RotateCcw } from "lucide-react";
import { algorithmLibrary, libraryById } from "@/lib/library";
import type { AlgorithmInput, Language } from "@/lib/types";

const languageNames: Record<Language, string> = { python: "Python 3", cpp: "C++17", java: "Java 17+" };

export function CodeEditorPanel({
  side,
  value,
  onChange,
  onReset,
}: {
  side: "A" | "B";
  value: AlgorithmInput;
  onChange: (next: AlgorithmInput) => void;
  onReset: () => void;
}) {
  const extension = value.language === "python" ? python() : value.language === "cpp" ? cpp() : java();
  const profile = value.libraryId ? libraryById.get(value.libraryId) : undefined;
  return (
    <section className="editor-panel" aria-label={`Algorithm ${side} source editor`}>
      <div className="editor-panel__top">
        <div className={`algorithm-monogram algorithm-monogram--${side.toLowerCase()}`}>{side}</div>
        <div className="editor-panel__identity">
          <span>Algorithm {side}</span>
          <strong>{profile?.name ?? "Custom source"}</strong>
        </div>
        <button className="icon-button subtle" type="button" onClick={onReset} title={`Reset algorithm ${side}`} aria-label={`Reset algorithm ${side} to its library template`}>
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="editor-toolbar">
        <label className="select-control select-control--library">
          <Library size={14} aria-hidden="true" />
          <span className="sr-only">Choose a library algorithm for {side}</span>
          <select
            value={value.libraryId ?? ""}
            onChange={(event) => onChange({ ...value, libraryId: event.target.value || null })}
          >
            <option value="">Custom / edited code</option>
            {[...new Set(algorithmLibrary.map((algorithm) => algorithm.family))].map((family) => (
              <optgroup key={family} label={family}>
                {algorithmLibrary.filter((algorithm) => algorithm.family === family).map((algorithm) => (
                  <option key={algorithm.id} value={algorithm.id}>{algorithm.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown size={13} aria-hidden="true" />
        </label>
        <label className="select-control select-control--language">
          <Braces size={14} aria-hidden="true" />
          <span className="sr-only">Programming language for algorithm {side}</span>
          <select value={value.language} onChange={(event) => onChange({ ...value, language: event.target.value as Language })}>
            {(Object.keys(languageNames) as Language[]).map((language) => <option key={language} value={language}>{languageNames[language]}</option>)}
          </select>
          <ChevronDown size={13} aria-hidden="true" />
        </label>
      </div>
      <div className="algorithm-editor">
        <CodeMirror
          value={value.code}
          height="420px"
          theme={oneDark}
          extensions={[extension]}
          onChange={(code) => onChange({ ...value, code })}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: true,
            autocompletion: true,
            indentOnInput: true,
          }}
          aria-label={`Algorithm ${side} ${languageNames[value.language]} code`}
        />
      </div>
      <div className="editor-contract">
        <span className="contract-prompt">CONTRACT</span>
        <p>{profile?.inputContract ?? (value.language === "python"
          ? "Define solve(data). JSON input is decoded before timing; return a JSON-serializable value."
          : value.language === "cpp"
            ? "Define Json solve(Json& data). The harness provides Json::at(), array(), object(), and integer()."
            : "Define public static Object solve(Object data) inside public class Algorithm; java.util imports are allowlisted.")}</p>
      </div>
    </section>
  );
}
