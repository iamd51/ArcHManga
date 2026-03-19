"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import { useCurrentPage, useEditorStore } from "@/store/editor-store";

const PAGE_PADDING = 24;
const PANEL_INSET = 14;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function usePanelImage(src?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.onload = () => setImage(nextImage);
    nextImage.onerror = () => setImage(null);
    nextImage.src = src;

    return () => {
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [src]);

  return image;
}

function summarizeCharacterLocks(
  panel: ReturnType<typeof useCurrentPage>["panels"][number],
  characterNames: Map<string, string>
) {
  return (panel.prompt.revisionIntent.characterLocks ?? [])
    .map((lock) => {
      const positiveTokens = [
        lock.preserveCharacterIdentity ? "ID" : "",
        lock.lockCharacterAppearance ? "APP" : "",
        lock.lockCharacterWardrobe ? "WRD" : "",
        lock.lockCharacterExpression ? "EXP" : "",
        lock.lockCameraFraming ? "CAM" : ""
      ].filter(Boolean);
      const releasedTokens = [
        lock.lockCharacterAppearance === false ? "APP free" : "",
        lock.lockCharacterWardrobe === false ? "WRD free" : "",
        lock.lockCharacterExpression === false ? "EXP free" : "",
        lock.lockCameraFraming === false ? "CAM free" : ""
      ].filter(Boolean);
      const bits = [...positiveTokens, ...releasedTokens];
      if (!bits.length && !lock.note) {
        return null;
      }
      const name = characterNames.get(lock.characterId) ?? lock.characterId;
      return `${name}: ${[...bits, lock.note].filter(Boolean).join(" · ")}`;
    })
    .filter((line): line is string => Boolean(line));
}

function PanelNode({
  panel,
  index,
  selected,
  renderMode,
  characterLockLines,
  onSelect,
  onDragEnd,
  panelRef,
  maskRef,
  onMaskChange
}: {
  panel: ReturnType<typeof useCurrentPage>["panels"][number];
  index: number;
  selected: boolean;
  renderMode: "editor" | "export";
  characterLockLines: string[];
  onSelect: () => void;
  onDragEnd: (event: KonvaEventObject<DragEvent>) => void;
  panelRef: (node: any) => void;
  maskRef: (node: any) => void;
  onMaskChange: (updates: Partial<typeof panel.inpaintMask>) => void;
}) {
  const panelImage = usePanelImage(panel.imageUrl);
  const innerWidth = Math.max(panel.width - PANEL_INSET * 2, 40);
  const innerHeight = Math.max(panel.height - PANEL_INSET * 2, 40);
  const showImage = Boolean(panelImage);
  const imageRatio = panelImage ? Math.max(innerWidth / panelImage.width, innerHeight / panelImage.height) : 1;
  const imageWidth = panelImage ? panelImage.width * imageRatio : innerWidth;
  const imageHeight = panelImage ? panelImage.height * imageRatio : innerHeight;
  const imageX = PANEL_INSET + (innerWidth - imageWidth) / 2;
  const imageY = PANEL_INSET + (innerHeight - imageHeight) / 2;
  const maskX = PANEL_INSET + innerWidth * panel.inpaintMask.x;
  const maskY = PANEL_INSET + innerHeight * panel.inpaintMask.y;
  const maskWidth = innerWidth * panel.inpaintMask.width;
  const maskHeight = innerHeight * panel.inpaintMask.height;

  return (
    <Group
      x={panel.x}
      y={panel.y}
      width={panel.width}
      height={panel.height}
      rotation={panel.rotation}
      draggable={renderMode === "editor"}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={onDragEnd}
      ref={panelRef}
    >
      <Rect
        width={panel.width}
        height={panel.height}
        fill={renderMode === "export" ? "#ffffff" : showImage ? "rgba(244, 234, 222, 0.98)" : panel.mode === "bw" ? "rgba(255,255,255,0.98)" : "rgba(250, 242, 235, 0.98)"}
        stroke={renderMode === "export" ? "#171412" : selected ? "#d26e37" : "rgba(24, 20, 17, 0.92)"}
        strokeWidth={renderMode === "export" ? 2.5 : selected ? 4 : 3}
        cornerRadius={renderMode === "export" ? 6 : 16}
      />
      {showImage ? (
        <Group
          clipX={PANEL_INSET}
          clipY={PANEL_INSET}
          clipWidth={innerWidth}
          clipHeight={innerHeight}
        >
          <KonvaImage
            image={panelImage ?? undefined}
            x={imageX}
            y={imageY}
            width={imageWidth}
            height={imageHeight}
          />
          {renderMode === "editor" && panel.inpaintMask.enabled ? (
            <>
              <Rect x={PANEL_INSET} y={PANEL_INSET} width={innerWidth} height={innerHeight} fill="rgba(18, 16, 15, 0.48)" />
              <Rect
                x={maskX}
                y={maskY}
                width={maskWidth}
                height={maskHeight}
                fill="rgba(255, 246, 232, 0.12)"
                stroke="#ffd36b"
                strokeWidth={2}
                cornerRadius={Math.max(8, panel.inpaintMask.feather / 3)}
                shadowColor="rgba(255, 211, 107, 0.45)"
                shadowBlur={panel.inpaintMask.feather}
              />
            </>
          ) : null}
        </Group>
      ) : null}
      {renderMode === "editor" && panel.inpaintMask.enabled ? (
        <Rect
          x={maskX}
          y={maskY}
          width={maskWidth}
          height={maskHeight}
          fill="rgba(255, 244, 206, 0.16)"
          stroke="#ffd36b"
          dash={[8, 6]}
          strokeWidth={selected ? 2.5 : 2}
          cornerRadius={Math.max(8, panel.inpaintMask.feather / 3)}
          draggable
          ref={maskRef}
          onMouseDown={(event) => {
            event.cancelBubble = true;
            onSelect();
          }}
          onTap={(event) => {
            event.cancelBubble = true;
            onSelect();
          }}
          dragBoundFunc={(position) => ({
            x: clamp(position.x, PANEL_INSET, PANEL_INSET + innerWidth - maskWidth),
            y: clamp(position.y, PANEL_INSET, PANEL_INSET + innerHeight - maskHeight)
          })}
          onDragEnd={(event) => {
            event.cancelBubble = true;
            onMaskChange({
              x: clamp((event.target.x() - PANEL_INSET) / innerWidth, 0, 0.95),
              y: clamp((event.target.y() - PANEL_INSET) / innerHeight, 0, 0.95)
            });
          }}
          onTransformEnd={(event) => {
            const node = event.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            const nextX = clamp((node.x() - PANEL_INSET) / innerWidth, 0, 0.95);
            const nextY = clamp((node.y() - PANEL_INSET) / innerHeight, 0, 0.95);
            const nextWidth = clamp((node.width() * scaleX) / innerWidth, 0.05, 1);
            const nextHeight = clamp((node.height() * scaleY) / innerHeight, 0.05, 1);

            onMaskChange({
              x: nextX,
              y: nextY,
              width: nextWidth,
              height: nextHeight
            });

            node.scaleX(1);
            node.scaleY(1);
          }}
        />
      ) : null}
      {renderMode === "editor" ? (
        <>
          <Rect
            x={PANEL_INSET}
            y={PANEL_INSET}
            width={innerWidth}
            height={innerHeight}
            dash={[10, 8]}
            stroke={selected ? "rgba(210, 110, 55, 0.5)" : "rgba(23, 20, 18, 0.14)"}
            strokeWidth={1.5}
            cornerRadius={10}
          />
          <Text
            x={18}
            y={18}
            width={panel.width - 36}
            text={`${index + 1}. ${panel.title}`}
            fontSize={24}
            fill="#171412"
            fontStyle="bold"
          />
          <Text
            x={18}
            y={58}
            width={panel.width - 36}
            text={
              panel.imageUrl
                ? "Generated image attached. You can keep layout fixed and regenerate prompt or seed."
                : panel.prompt.prompt || "Describe this panel, then send it to ComfyUI."
            }
            fontSize={18}
            lineHeight={1.3}
            fill="rgba(23, 20, 18, 0.74)"
          />
          {panel.sceneMemoryId ? (
            <Text
              x={18}
              y={panel.height - 68}
              width={panel.width - 36}
              text={`Scene: ${panel.sceneMemoryId}`}
              fontSize={14}
              fill="rgba(23, 20, 18, 0.54)"
            />
          ) : null}
          <Text
            x={18}
            y={panel.height - 40}
            width={panel.width - 36}
            text={`${panel.mode.toUpperCase()}  |  ${panel.latestJobStatus ?? "idle"}  |  ${panel.modelId}`}
            fontSize={14}
            fill="rgba(23, 20, 18, 0.54)"
          />
          {panel.imageUrl ? (
            <Text
              x={18}
              y={94}
              width={panel.width - 36}
              text={panel.inpaintMask.enabled ? "Render ready · inpaint mask active" : "Render ready"}
              fontSize={16}
              fill="#8f6535"
              fontStyle="bold"
            />
          ) : null}
          {characterLockLines.length ? (
            <>
              <Rect
                x={panel.width - Math.min(panel.width - 24, 250)}
                y={16}
                width={Math.min(panel.width - 24, 232)}
                height={24 + characterLockLines.length * 20}
                fill="rgba(23, 20, 18, 0.8)"
                cornerRadius={12}
              />
              <Text
                x={panel.width - Math.min(panel.width - 24, 238)}
                y={24}
                width={Math.min(panel.width - 36, 216)}
                text={`Character locks\n${characterLockLines.join("\n")}`}
                fontSize={13}
                lineHeight={1.35}
                fill="#fff8ef"
                align="left"
              />
            </>
          ) : null}
        </>
      ) : null}
    </Group>
  );
}

export function PageCanvas({
  stageRef,
  renderMode = "editor"
}: {
  stageRef?: RefObject<KonvaStage | null>;
  renderMode?: "editor" | "export";
}) {
  const page = useCurrentPage();
  const projectCharacters = useEditorStore((state) => state.project.characters);
  const selectedPanelId = useEditorStore((state) => state.selectedPanelId);
  const selectPanel = useEditorStore((state) => state.selectPanel);
  const updatePanelFrame = useEditorStore((state) => state.updatePanelFrame);
  const updatePanelInpaintMask = useEditorStore((state) => state.updatePanelInpaintMask);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rectRefs = useRef<Record<string, any>>({});
  const maskRefs = useRef<Record<string, any>>({});
  const transformerRef = useRef<any>(null);
  const maskTransformerRef = useRef<any>(null);
  const [containerWidth, setContainerWidth] = useState(980);
  const selectedPanel = page.panels.find((panel) => panel.id === selectedPanelId) ?? null;
  const characterNames = new Map(projectCharacters.map((character) => [character.id, character.name]));

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedPanelId || !transformerRef.current) {
      return;
    }

    const node = rectRefs.current[selectedPanelId];
    if (node) {
      transformerRef.current.nodes([node]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [renderMode, selectedPanelId, page.panels]);

  useEffect(() => {
    if (!maskTransformerRef.current) {
      return;
    }

    if (!selectedPanelId || !selectedPanel?.inpaintMask.enabled) {
      maskTransformerRef.current.nodes([]);
      maskTransformerRef.current.getLayer()?.batchDraw();
      return;
    }

    const node = maskRefs.current[selectedPanelId];
    if (node) {
      maskTransformerRef.current.nodes([node]);
      maskTransformerRef.current.getLayer()?.batchDraw();
    }
  }, [renderMode, selectedPanel, selectedPanelId]);

  const stageScale = Math.min((containerWidth - PAGE_PADDING * 2) / page.width, 1);
  const stageWidth = page.width * stageScale;
  const stageHeight = page.height * stageScale;

  const handleStageMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    if (event.target === event.target.getStage()) {
      selectPanel(null);
    }
  };

  return (
    <div className="canvas-shell" ref={containerRef}>
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={stageScale}
        scaleY={stageScale}
        onMouseDown={handleStageMouseDown}
      >
        <Layer>
          <Rect
            x={0}
            y={0}
            width={page.width}
            height={page.height}
            cornerRadius={renderMode === "export" ? 0 : 26}
            fill="#fffdf9"
            stroke={renderMode === "export" ? "#ffffff" : "rgba(23, 20, 18, 0.12)"}
            strokeWidth={renderMode === "export" ? 0 : 2}
            shadowBlur={renderMode === "export" ? 0 : 36}
            shadowColor="rgba(36, 23, 12, 0.18)"
            shadowOffsetY={14}
            onMouseDown={() => selectPanel(null)}
          />

          {page.panels.map((panel, index) => {
            return (
              <PanelNode
                key={panel.id}
                panel={panel}
                index={index}
                selected={panel.id === selectedPanelId}
                renderMode={renderMode}
                characterLockLines={summarizeCharacterLocks(panel, characterNames)}
                onSelect={() => selectPanel(panel.id)}
                onDragEnd={(event) => {
                  updatePanelFrame(panel.id, {
                    x: Math.max(24, event.target.x()),
                    y: Math.max(24, event.target.y())
                  });
                }}
                onMaskChange={(updates) => updatePanelInpaintMask(panel.id, updates)}
                panelRef={(node) => {
                  if (node) {
                    rectRefs.current[panel.id] = node;
                  }
                }}
                maskRef={(node) => {
                  if (node) {
                    maskRefs.current[panel.id] = node;
                  }
                }}
              />
            );
          })}

          {renderMode === "editor" ? (
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              borderStroke="#d26e37"
              anchorFill="#fff"
              anchorStroke="#d26e37"
              anchorSize={10}
              boundBoxFunc={(_, newBox) => ({
                ...newBox,
                width: Math.max(120, newBox.width),
                height: Math.max(120, newBox.height)
              })}
              onTransformEnd={() => {
                const selectedNode = selectedPanelId ? rectRefs.current[selectedPanelId] : null;
                if (!selectedPanelId || !selectedNode) {
                  return;
                }

                const scaleX = selectedNode.scaleX();
                const scaleY = selectedNode.scaleY();

                updatePanelFrame(selectedPanelId, {
                  x: selectedNode.x(),
                  y: selectedNode.y(),
                  width: Math.max(120, selectedNode.width() * scaleX),
                  height: Math.max(120, selectedNode.height() * scaleY)
                });

                selectedNode.scaleX(1);
                selectedNode.scaleY(1);
              }}
            />
          ) : null}
          {renderMode === "editor" ? (
            <Transformer
              ref={maskTransformerRef}
              rotateEnabled={false}
              borderStroke="#ffd36b"
              anchorFill="#fff8df"
              anchorStroke="#d9a11e"
              anchorSize={9}
              enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
              boundBoxFunc={(_, newBox) => ({
                ...newBox,
                width: Math.max(48, newBox.width),
                height: Math.max(48, newBox.height)
              })}
            />
          ) : null}
        </Layer>
      </Stage>
    </div>
  );
}
