// Copyright (c) 2022 - for information on the respective copyright owner see the NOTICE file or the
// repository https://github.com/boschresearch/pr-size-labeller.
//
// SPDX-License-Identifier: Apache-2.0

// This file implements a GitHub Action to add labels and comments according 
// to a PRs size.

const core = require("@actions/core")
const github = require("@actions/github")
const path = require("path")
const yaml = require("js-yaml")
const fs = require("fs")

function getOctokit() {
  const token = core.getInput("github-token", { required: true })
  return github.getOctokit(token)
}

async function getPull(octokit, context) {
  const pull = await octokit.rest.pulls.get({
    pull_number: context.issue.number,
    owner: context.repo.owner,
    repo: context.repo.repo,
  })
  return pull.data
}

async function getDiffSize(octokit, context) {
  const pull = await getPull(octokit, context)
  const diffSize = pull.additions + pull.deletions
  console.log("Found PR with diffSize " + diffSize)
  return diffSize
}

function parseInput(bucketConfigFile) {
  if ("" === bucketConfigFile) {
    bucketConfigFile = path.resolve(__dirname, "defaultBuckets.yml")
    console.log("Using default bucket settings from " + bucketConfigFile)
  } else {
    console.log("Reading bucket settings from " + bucketConfigFile)
  }
  const buckets = yaml.load(fs.readFileSync(bucketConfigFile, "utf8"))
  return buckets.buckets
}

function getPRBucket(diffSize, buckets) {
  // Determine label for PR
  let assignedBucket = null
  buckets.forEach((bucket) => {
    if (
      diffSize < bucket.maxSize &&
      (assignedBucket === null || assignedBucket.size > bucket.maxSize)
    ) {
      assignedBucket = bucket
    }
  })
  console.log(
    "Received diff size " +
      diffSize +
      ". Assigning label '" +
      assignedBucket.label +
      " to it...",
  )
  return assignedBucket
}

async function getOldLabels(octokit, context) {
  // Check which labels are already set
  console.log("Getting labels for PR-" + context.issue.number)
  const pull = await getPull(octokit, context)
  const oldLabels = pull.labels
  const oldLabelNames = oldLabels.map((it) => it.name)
  console.log("Found labels on PR: " + oldLabelNames)
  return oldLabelNames
}

function updateLabels(
  octokit,
  context,
  newLabel,
  oldLabelNames,
  supportedLabels,
) {
  // Update labels in case they are not up to date
  supportedLabels.forEach((supportedLabel) => {
    if (oldLabelNames.includes(supportedLabel) && supportedLabel !== newLabel) {
      console.log("Removing previously assigned label: " + supportedLabel)
      octokit.rest.issues.removeLabel({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        name: supportedLabel,
      })
    } else if (
      supportedLabel === newLabel &&
      !oldLabelNames.includes(supportedLabel)
    ) {
      console.log("Adding label: " + newLabel)
      octokit.rest.issues.addLabels({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        labels: [newLabel],
      })
    }
  })
}

function addCommentIfNotNull(octokit, context, oldLabelNames, assignedBucket) {
  // Add a warning comment to the PR in case it has moved category
  if (
    assignedBucket.comment !== null &&
    !oldLabelNames.includes(assignedBucket.label)
  ) {
    console.log("Adding comment: " + assignedBucket.comment)
    octokit.rest.issues.createComment({
      issue_number: context.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: assignedBucket.comment,
    })
  }
}

async function main() {
  const octokit = getOctokit()
  const diffSize = await getDiffSize(octokit, github.context)
  if (Math.floor(diffSize) !== Number(diffSize)) {
    console.log("Error: DiffSize is not of integer type.")
    process.exit(1)
  }
  const buckets = parseInput(core.getInput("bucketConfigFile"))
  const assignedBucket = getPRBucket(diffSize, buckets)
  const oldLabelNames = await getOldLabels(octokit, github.context)
  const supportedLabels = buckets.map((it) => {
    return it.label
  })
  updateLabels(
    octokit,
    github.context,
    assignedBucket.label,
    oldLabelNames,
    supportedLabels,
  )
  addCommentIfNotNull(octokit, github.context, oldLabelNames, assignedBucket)
}

main().catch((err) => {
  core.setFailed(err.message)
  console.trace(err)
})
