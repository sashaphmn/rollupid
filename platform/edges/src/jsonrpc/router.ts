import { initTRPC } from '@trpc/server'

import { errorFormatter } from '@proofzero/utils/trpc'

import type { Context } from '../context'

import {
  findNodeBatchMethod,
  FindNodeBatchMethodInput,
  FindNodeBatchMethodOutput,
  findNodeMethod,
  FindNodeMethodInput,
  FindNodeMethodOutput,
} from './methods/findNode'
import {
  getEdgesMethod,
  GetEdgesMethodInput,
  GetEdgesMethodOutput,
} from './methods/getEdges'
import {
  makeEdgeMethod,
  MakeEdgeMethodInput,
  MakeEdgeMethodOutput,
} from './methods/makeEdge'
import {
  removeEdgeMethod,
  RemoveEdgeMethodInput,
  RemoveEdgeMethodOutput,
} from './methods/removeEdge'

import { LogUsage } from '@proofzero/platform-middleware/log'

import {
  updateNodeCompsMethod,
  UpdateNodeCompsMethodInput,
  UpdateNodeCompsMethodOutput,
} from './methods/updateNodeComps'
import {
  deleteNodeMethod,
  DeleteNodeMethodInput,
  DeleteNodeMethodOutput,
} from './methods/deleteNode'

const t = initTRPC.context<Context>().create({ errorFormatter })

export const appRouter = t.router({
  findNode: t.procedure
    .use(LogUsage)
    .input(FindNodeMethodInput)
    .output(FindNodeMethodOutput)
    .query(findNodeMethod),
  findNodeBatch: t.procedure
    .use(LogUsage)
    .input(FindNodeBatchMethodInput)
    .output(FindNodeBatchMethodOutput)
    .query(findNodeBatchMethod),
  deleteNode: t.procedure
    .use(LogUsage)
    .input(DeleteNodeMethodInput)
    .output(DeleteNodeMethodOutput)
    .mutation(deleteNodeMethod),
  updateNode: t.procedure
    .use(LogUsage)
    .input(UpdateNodeCompsMethodInput)
    .output(UpdateNodeCompsMethodOutput)
    .mutation(updateNodeCompsMethod),
  getEdges: t.procedure
    .use(LogUsage)
    .input(GetEdgesMethodInput)
    .output(GetEdgesMethodOutput)
    .query(getEdgesMethod),
  makeEdge: t.procedure
    .use(LogUsage)
    .input(MakeEdgeMethodInput)
    .output(MakeEdgeMethodOutput)
    .mutation(makeEdgeMethod),
  removeEdge: t.procedure
    .use(LogUsage)
    .input(RemoveEdgeMethodInput)
    .output(RemoveEdgeMethodOutput)
    .mutation(removeEdgeMethod),
})
