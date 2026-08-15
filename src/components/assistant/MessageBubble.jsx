import React from "react";
import ReactMarkdown from "react-markdown";
import { Bot } from "lucide-react";
import FunctionDisplay from "./FunctionDisplay";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5"
            : "max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5"
        }
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
            <Bot className="w-3.5 h-3.5" />
            <span className="font-medium">Asistente</span>
          </div>
        )}
        {message.content && (
          isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <ReactMarkdown className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
              {message.content}
            </ReactMarkdown>
          )
        )}
        {message.tool_calls?.map((toolCall, idx) => (
          <FunctionDisplay key={idx} toolCall={toolCall} />
        ))}
      </div>
    </div>
  );
}