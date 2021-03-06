import * as H from 'history'
import FileIcon from 'mdi-react/FileIcon'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { replaceRevisionInURL } from '.'
import { createInvalidGraphQLQueryResponseError, dataOrThrowErrors, gql, queryGraphQL } from '../backend/graphql'
import * as GQL from '../backend/graphqlschema'
import { FilteredConnection } from '../components/FilteredConnection'
import { GitCommitNode } from './commits/GitCommitNode'
import { gitCommitFragment } from './commits/RepositoryCommitsPage'

interface CommitNodeProps {
    node: GQL.IGitCommit
    repoName: string
    location: H.Location
}

const CommitNode: React.SFC<CommitNodeProps> = ({ node, repoName, location }) => (
    <li className="list-group-item p-0">
        <GitCommitNode
            compact={true}
            node={node}
            hideExpandCommitMessageBody={true}
            repoName={repoName}
            afterElement={
                <Link
                    to={replaceRevisionInURL(location.pathname + location.search + location.hash, node.oid as string)}
                    className="ml-2"
                    title="View current file at this commit"
                >
                    <FileIcon className="icon-inline" />
                </Link>
            }
        />
    </li>
)

interface Props {
    repoID: GQL.ID
    repoName: string
    rev: string | undefined
    filePath: string
    history: H.History
    location: H.Location
}

export class RepoRevSidebarCommits extends React.PureComponent<Props> {
    public render(): JSX.Element | null {
        return (
            <FilteredConnection<GQL.IGitCommit, Pick<CommitNodeProps, 'repoName' | 'location'>>
                className="list-group list-group-flush"
                compact={true}
                noun="commit"
                pluralNoun="commits"
                queryConnection={this.fetchCommits}
                nodeComponent={CommitNode}
                nodeComponentProps={
                    { repoName: this.props.repoName, location: this.props.location } as Pick<
                        CommitNodeProps,
                        'repoName' | 'location'
                    >
                }
                defaultFirst={100}
                hideSearch={true}
                shouldUpdateURLQuery={false}
                history={this.props.history}
                location={this.props.location}
            />
        )
    }

    private fetchCommits = (args: { query?: string }): Observable<GQL.IGitCommitConnection> =>
        fetchCommits(this.props.repoID, this.props.rev || '', { ...args, currentPath: this.props.filePath || '' })
}

function fetchCommits(
    repo: GQL.ID,
    rev: string,
    args: { first?: number; currentPath?: string; query?: string }
): Observable<GQL.IGitCommitConnection> {
    return queryGraphQL(
        gql`
            query FetchCommits($repo: ID!, $rev: String!, $first: Int, $currentPath: String, $query: String) {
                node(id: $repo) {
                    ... on Repository {
                        commit(rev: $rev) {
                            ancestors(first: $first, query: $query, path: $currentPath) {
                                nodes {
                                    ...GitCommitFields
                                }
                            }
                        }
                    }
                }
            }
            ${gitCommitFragment}
        `,
        { ...args, repo, rev }
    ).pipe(
        map(dataOrThrowErrors),
        map(data => {
            if (!data.node || !(data.node as GQL.IRepository).commit) {
                throw createInvalidGraphQLQueryResponseError('FetchCommits')
            }
            return (data.node as GQL.IRepository).commit!.ancestors
        })
    )
}
