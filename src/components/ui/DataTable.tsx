import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Table, TableScroll, TBody, TD, TH, THead, TR } from './Table';

export interface Column<Row> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right' | 'center';
  sticky?: boolean;
  render: (row: Row, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  data: Row[];
  rowKey: (row: Row, index: number) => string;
  highlightRow?: (row: Row, index: number) => boolean;
  className?: string;
  stickyHeader?: boolean;
  maxHeight?: number;
}

/** Generic, styled table for simple grids. Complex grids compose `Table` primitives directly. */
export function DataTable<Row>({
  columns,
  data,
  rowKey,
  highlightRow,
  className,
  stickyHeader = true,
  maxHeight,
}: DataTableProps<Row>) {
  return (
    <TableScroll className={cn(className)} >
      <div style={maxHeight ? { maxHeight } : undefined} className={maxHeight ? 'overflow-auto scrollbar-thin' : undefined}>
        <Table>
          <THead sticky={stickyHeader}>
            <TR>
              {columns.map((c) => (
                <TH key={c.key} align={c.align} sticky={c.sticky} className={c.headerClassName}>
                  {c.header}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {data.map((row, i) => (
              <TR key={rowKey(row, i)} highlight={highlightRow?.(row, i)}>
                {columns.map((c) => (
                  <TD key={c.key} align={c.align} sticky={c.sticky} className={c.className}>
                    {c.render(row, i)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </TableScroll>
  );
}
