"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from "react-konva";
import { useCurrentPage, useEditorStore } from "@/store/editor-store";

const PAGE_PADDING = 24;

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

function PanelNode({
  panel,
  index,
  selected,
  renderMode,
  onSelect,
  onDragEnd,
  panelRef
}: {
  panel: ReturnType<typeof useCurrentPage>["panels"][number];
  index: number;
  selected: boolean;
  renderMode: "editor" | "export";
  onSelect: () => void;
  onDragEnd: (event: KonvaEventObject<DragEvent>) => void;
  panelRef: (node: any) => void;
}) {
  const panelImage = usePanelImage(panel.imageUrl);
  const innerWidth = Math.max(panel.width - 28, 40);
  const innerHeight = Math.max(panel.height - 28, 40);
  const showImage = Boolean(panelImage);
  const imageRatio = panelImage ? Math.max(innerWidth / panelImage.width, innerHeight / panelImage.height) : 1;
  const imageWidth = panelImage ? panelImage.width * imageRatio : innerWidth;
  const imageHeight = panelImage ? panelImage.height * imageRatio : innerHeight;
  const imageX = 14 + (innerWidth - imageWidth) / 2;
  const imageY = 14 + (innerHeight - imageHeight) / 2;

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
        <Group clipX={14} clipY={14} clipWidth={innerWidth} clipHeight={innerHeight}>
          <KonvaImage
            image={panelImage ?? undefined}
            x={imageX}
            y={imageY}
            width={imageWidth}
            height={imageHeight}
          />
        </Group>
      ) : null}
      {renderMode === "editor" ? (
        <>
          <Rect
            x={14}
            y={14}
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
              text="Render ready"
              fontSize={16}
              fill="#8f6535"
              fontStyle="bold"
            />
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
  const selectedPanelId = useEditorStore((state) => state.selectedPanelId);
  const selectPanel = useEditorStore((state) => state.selectPanel);
  const updatePanelFrame = useEditorStore((state) => state.updatePanelFrame);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rectRefs = useRef<Record<string, any>>({});
  const transformerRef = useRef<any>(null);
  const [containerWidth, setContainerWidth] = useState(980);

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
                onSelect={() => selectPanel(panel.id)}
                onDragEnd={(event) => {
                  updatePanelFrame(panel.id, {
                    x: Math.max(24, event.target.x()),
                    y: Math.max(24, event.target.y())
                  });
                }}
                panelRef={(node) => {
                  if (node) {
                    rectRefs.current[panel.id] = node;
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
        </Layer>
      </Stage>
    </div>
  );
}
